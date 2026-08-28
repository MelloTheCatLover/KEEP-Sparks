import { randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { pool } from "../config/db";
import { env } from "../config/env";
import { AppError } from "../middleware/error";
import {
  FestivalAdminBoard,
  FestivalBoard,
  FestivalEvent,
  FestivalJudge,
  FestivalJudgeView,
  FestivalNext,
  FestivalParticipant,
  FestivalPoint,
  FestivalRace,
  FestivalRaceInput,
  FestivalRosterRow,
  FestivalStanding,
  FestivalStation,
} from "../types/festival";

// Фестиваль живёт сам по себе: ни одной таблицы искр здесь нет. Участник —
// номер, а не ребёнок, и его результат никуда, кроме экрана показа, не идёт.
//
// В БД лежат только сырые отметки (`festival_event`) и баллы
// (`festival_point`). Круг, позиция на круге, время и оба рейтинга считаются
// при чтении — как и везде в проекте.

const RACE_COLUMNS =
  "id, title, slug, laps, stations, started_at, finished_at, created_at";

// ---------------------------------------------------------------- загрузка

async function loadRace(raceId: number): Promise<FestivalRace> {
  const { rows } = await pool.query<FestivalRace>(
    `SELECT ${RACE_COLUMNS} FROM festival_race WHERE id = $1`,
    [raceId],
  );
  if (rows.length === 0) throw new AppError(404, "Гонка не найдена");
  return rows[0];
}

async function loadRaceBySlug(slug: string): Promise<FestivalRace> {
  const { rows } = await pool.query<FestivalRace>(
    `SELECT ${RACE_COLUMNS} FROM festival_race WHERE slug = $1`,
    [slug],
  );
  if (rows.length === 0) throw new AppError(404, "Гонка не найдена");
  return rows[0];
}

async function loadStations(raceId: number): Promise<FestivalStation[]> {
  const { rows } = await pool.query<FestivalStation>(
    "SELECT idx, name FROM festival_station WHERE race_id = $1 ORDER BY idx",
    [raceId],
  );
  return rows;
}

async function loadParticipants(
  raceId: number,
): Promise<FestivalParticipant[]> {
  const { rows } = await pool.query<FestivalParticipant>(
    `SELECT id, number, name, team FROM festival_participant
     WHERE race_id = $1 ORDER BY number`,
    [raceId],
  );
  return rows;
}

async function loadEvents(raceId: number): Promise<FestivalEvent[]> {
  const { rows } = await pool.query<FestivalEvent>(
    `SELECT id::int, participant_id, kind, station_idx, lap, at
     FROM festival_event WHERE race_id = $1 ORDER BY at, id`,
    [raceId],
  );
  return rows;
}

async function loadPoints(raceId: number): Promise<FestivalPoint[]> {
  const { rows } = await pool.query<FestivalPoint>(
    `SELECT id::int, participant_id, lap, points, note, at
     FROM festival_point WHERE race_id = $1 ORDER BY at, id`,
    [raceId],
  );
  return rows;
}

// ------------------------------------------------------------ вычисления

interface Progress {
  lapsClosed: number;
  lap: number; // текущий круг, у финишировавших — последний
  stationsDone: number; // рубежей пройдено на текущем круге
  finished: boolean;
  finishAt: string | null;
  lastAt: string | null;
  marks: number; // сколько всего отметок — этим меряется «кто дальше»
}

// Последовательность жёсткая: рубеж 1 → … → рубеж N → закрытие круга, и так
// `laps` раз. Поэтому состояние участника целиком выводится из количества
// отметок, а «следующая точка» всегда однозначна.
function progressOf(
  race: FestivalRace,
  events: FestivalEvent[],
): Progress {
  const lapEvents = events.filter((e) => e.kind === "lap");
  const lapsClosed = lapEvents.length;
  const finished = lapsClosed >= race.laps;
  const lap = finished ? race.laps : lapsClosed + 1;
  const stationsDone = finished
    ? race.stations
    : events.filter((e) => e.kind === "station" && e.lap === lap).length;
  const last = events.length > 0 ? events[events.length - 1] : null;

  return {
    lapsClosed,
    lap,
    stationsDone,
    finished,
    finishAt: finished ? lapEvents[race.laps - 1].at : null,
    lastAt: last ? last.at : null,
    marks: events.length,
  };
}

function nextPoint(race: FestivalRace, p: Progress): FestivalNext | null {
  if (p.finished) return null;
  if (p.stationsDone < race.stations) {
    return { kind: "station", lap: p.lap, station_idx: p.stationsDone + 1 };
  }
  return { kind: "lap", lap: p.lap, station_idx: null };
}

function seconds(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 1000;
}

// Ранг с общими местами: одинаковый ключ — одинаковое место.
function rankBy<T>(sorted: T[], key: (item: T) => string): Map<T, number> {
  const ranks = new Map<T, number>();
  let rank = 0;
  let prev: string | null = null;
  sorted.forEach((item, i) => {
    const k = key(item);
    if (k !== prev) {
      rank = i + 1;
      prev = k;
    }
    ranks.set(item, rank);
  });
  return ranks;
}

// Два рейтинга, как договорились: по времени и по баллам, независимо друг от
// друга. Незакончившие в рейтинге времени идут после финишировавших — по
// пройденному расстоянию, при равенстве раньше тот, кто раньше отметился.
function standingsOf(
  race: FestivalRace,
  participants: FestivalParticipant[],
  events: FestivalEvent[],
  points: FestivalPoint[],
): FestivalStanding[] {
  const rows = participants.map((p) => {
    const own = events.filter((e) => e.participant_id === p.id);
    const prog = progressOf(race, own);
    const total = points
      .filter((pt) => pt.participant_id === p.id)
      .reduce((sum, pt) => sum + pt.points, 0);

    return {
      participant_id: p.id,
      number: p.number,
      name: p.name,
      team: p.team,
      lap: prog.lap,
      stations_done: prog.stationsDone,
      finished: prog.finished,
      finish_seconds:
        prog.finished && race.started_at && prog.finishAt
          ? seconds(race.started_at, prog.finishAt)
          : null,
      last_at: prog.lastAt,
      points: total,
      time_rank: 0,
      points_rank: 0,
    };
  });

  const byTime = [...rows].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) {
      return (a.finish_seconds ?? 0) - (b.finish_seconds ?? 0);
    }
    const marks = (r: FestivalStanding) =>
      (r.lap - 1) * (race.stations + 1) + r.stations_done;
    if (marks(a) !== marks(b)) return marks(b) - marks(a);
    if (a.last_at && b.last_at && a.last_at !== b.last_at) {
      return a.last_at < b.last_at ? -1 : 1;
    }
    return a.number - b.number;
  });
  const timeRanks = rankBy(byTime, (r) =>
    r.finished
      ? `f:${r.finish_seconds}`
      : `p:${(r.lap - 1) * (race.stations + 1) + r.stations_done}:${r.last_at ?? ""}`,
  );

  const byPoints = [...rows].sort(
    (a, b) => b.points - a.points || a.number - b.number,
  );
  const pointRanks = rankBy(byPoints, (r) => String(r.points));

  for (const row of rows) {
    row.time_rank = timeRanks.get(row) ?? 0;
    row.points_rank = pointRanks.get(row) ?? 0;
  }
  return rows;
}

// --------------------------------------------------------------- экраны

export async function getBoardBySlug(slug: string): Promise<FestivalBoard> {
  const race = await loadRaceBySlug(slug);
  const [stations, participants, events, points] = await Promise.all([
    loadStations(race.id),
    loadParticipants(race.id),
    loadEvents(race.id),
    loadPoints(race.id),
  ]);

  return {
    race,
    stations,
    standings: standingsOf(race, participants, events, points),
    server_time: new Date().toISOString(),
  };
}

export async function getAdminBoard(
  raceId: number,
): Promise<FestivalAdminBoard> {
  const race = await loadRace(raceId);
  const [stations, participants, events, points] = await Promise.all([
    loadStations(race.id),
    loadParticipants(race.id),
    loadEvents(race.id),
    loadPoints(race.id),
  ]);
  const judges = await pool.query<FestivalJudge>(
    `SELECT j.id, j.participant_id, j.name, j.pin
     FROM festival_judge j
     JOIN festival_participant p ON p.id = j.participant_id
     WHERE j.race_id = $1 ORDER BY p.number`,
    [raceId],
  );

  return {
    race,
    stations,
    participants,
    judges: judges.rows,
    events,
    points,
    standings: standingsOf(race, participants, events, points),
    server_time: new Date().toISOString(),
  };
}

export async function listRaces(): Promise<FestivalRace[]> {
  const { rows } = await pool.query<FestivalRace>(
    `SELECT ${RACE_COLUMNS} FROM festival_race ORDER BY created_at DESC, id DESC`,
  );
  return rows;
}

// ------------------------------------------------------- админ: гонка

export async function createRace(
  input: FestivalRaceInput,
): Promise<FestivalRace> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<FestivalRace>(
      `INSERT INTO festival_race (title, slug, laps, stations)
       VALUES ($1, $2, $3, $4) RETURNING ${RACE_COLUMNS}`,
      [input.title, input.slug, input.laps, input.stations],
    );
    const race = rows[0];
    for (let idx = 1; idx <= race.stations; idx++) {
      await client.query(
        "INSERT INTO festival_station (race_id, idx, name) VALUES ($1, $2, $3)",
        [race.id, idx, `Рубеж ${idx}`],
      );
    }
    await client.query("COMMIT");
    return race;
  } catch (err) {
    await client.query("ROLLBACK");
    if (typeof err === "object" && err !== null && "code" in err) {
      if ((err as { code: string }).code === "23505") {
        throw new AppError(409, "Гонка с таким адресом экрана уже есть");
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteRace(raceId: number): Promise<void> {
  const { rowCount } = await pool.query(
    "DELETE FROM festival_race WHERE id = $1",
    [raceId],
  );
  if (rowCount === 0) throw new AppError(404, "Гонка не найдена");
}

export async function setStations(
  raceId: number,
  names: string[],
): Promise<FestivalAdminBoard> {
  const race = await loadRace(raceId);
  if (names.length !== race.stations) {
    throw new AppError(400, `Нужно ровно ${race.stations} названий рубежей`);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let idx = 1; idx <= race.stations; idx++) {
      await client.query(
        `INSERT INTO festival_station (race_id, idx, name) VALUES ($1, $2, $3)
         ON CONFLICT (race_id, idx) DO UPDATE SET name = EXCLUDED.name`,
        [raceId, idx, names[idx - 1].trim() || `Рубеж ${idx}`],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getAdminBoard(raceId);
}

async function generatePins(count: number): Promise<string[]> {
  const { rows } = await pool.query<{ pin: string }>(
    "SELECT pin FROM festival_judge",
  );
  const used = new Set(rows.map((r) => r.pin));
  const pins: string[] = [];
  while (pins.length < count) {
    const pin = String(randomInt(1000, 10000));
    if (used.has(pin)) continue;
    used.add(pin);
    pins.push(pin);
  }
  return pins;
}

// Ростер задаётся целиком: 22 номера с ФИ, командой и именем судьи. Каждому
// участнику сразу выпускается судья со своим PIN — раздать перед стартом.
// Переписать ростер можно, только пока нет ни одной отметки: иначе удаление
// участника унесло бы результаты вместе с ним.
export async function setRoster(
  raceId: number,
  rows: FestivalRosterRow[],
): Promise<FestivalAdminBoard> {
  await loadRace(raceId);
  if (rows.length === 0) throw new AppError(400, "Список участников пуст");

  const numbers = new Set(rows.map((r) => r.number));
  if (numbers.size !== rows.length) {
    throw new AppError(400, "Номера участников повторяются");
  }

  const marked = await pool.query<{ count: string }>(
    `SELECT (SELECT COUNT(*) FROM festival_event WHERE race_id = $1)
          + (SELECT COUNT(*) FROM festival_point WHERE race_id = $1) AS count`,
    [raceId],
  );
  if (Number(marked.rows[0].count) > 0) {
    throw new AppError(
      409,
      "В гонке уже есть отметки — сначала сбросьте результаты",
    );
  }

  const pins = await generatePins(rows.length);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM festival_participant WHERE race_id = $1", [
      raceId,
    ]);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO festival_participant (race_id, number, name, team)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [raceId, row.number, row.name, row.team],
      );
      await client.query(
        `INSERT INTO festival_judge (race_id, participant_id, name, pin)
         VALUES ($1, $2, $3, $4)`,
        [raceId, inserted.rows[0].id, row.judge_name, pins[i]],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getAdminBoard(raceId);
}

// Старт общий: одно время на всех, от него считаются все результаты.
export async function startRace(raceId: number): Promise<FestivalAdminBoard> {
  const race = await loadRace(raceId);
  if (race.started_at) throw new AppError(409, "Гонка уже стартовала");
  const participants = await loadParticipants(raceId);
  if (participants.length === 0) {
    throw new AppError(409, "Сначала заведите участников");
  }
  await pool.query(
    "UPDATE festival_race SET started_at = NOW(), finished_at = NULL WHERE id = $1",
    [raceId],
  );
  return getAdminBoard(raceId);
}

export async function finishRace(raceId: number): Promise<FestivalAdminBoard> {
  const race = await loadRace(raceId);
  if (!race.started_at) throw new AppError(409, "Гонка ещё не стартовала");
  await pool.query(
    "UPDATE festival_race SET finished_at = NOW() WHERE id = $1 AND finished_at IS NULL",
    [raceId],
  );
  return getAdminBoard(raceId);
}

// Сброс стирает результаты, но оставляет ростер и PIN: гонку можно перебежать
// тем же составом, ничего не раздавая заново.
export async function resetRace(raceId: number): Promise<FestivalAdminBoard> {
  await loadRace(raceId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM festival_event WHERE race_id = $1", [raceId]);
    await client.query("DELETE FROM festival_point WHERE race_id = $1", [raceId]);
    await client.query(
      "UPDATE festival_race SET started_at = NULL, finished_at = NULL WHERE id = $1",
      [raceId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getAdminBoard(raceId);
}

// Правка постфактум: админ может снять любую отметку и любой балл. Отметки
// удаляются с хвоста — порядок рубежей иначе развалится.
export async function deleteEventAsAdmin(
  eventId: number,
): Promise<FestivalAdminBoard> {
  const { rows } = await pool.query<{ race_id: number; participant_id: number }>(
    "SELECT race_id, participant_id FROM festival_event WHERE id = $1",
    [eventId],
  );
  if (rows.length === 0) throw new AppError(404, "Отметка не найдена");
  await pool.query("DELETE FROM festival_event WHERE id = $1", [eventId]);
  return getAdminBoard(rows[0].race_id);
}

export async function deletePointAsAdmin(
  pointId: number,
): Promise<FestivalAdminBoard> {
  const { rows } = await pool.query<{ race_id: number }>(
    "SELECT race_id FROM festival_point WHERE id = $1",
    [pointId],
  );
  if (rows.length === 0) throw new AppError(404, "Балл не найден");
  await pool.query("DELETE FROM festival_point WHERE id = $1", [pointId]);
  return getAdminBoard(rows[0].race_id);
}

// -------------------------------------------------------------- судья

export interface JudgeIdentity {
  id: number;
  race_id: number;
  participant_id: number;
  name: string | null;
}

export async function judgeByPin(pin: string): Promise<JudgeIdentity> {
  const { rows } = await pool.query<JudgeIdentity>(
    "SELECT id, race_id, participant_id, name FROM festival_judge WHERE pin = $1",
    [pin],
  );
  if (rows.length === 0) throw new AppError(401, "Неверный код");
  return rows[0];
}

export async function judgeById(judgeId: number): Promise<JudgeIdentity> {
  const { rows } = await pool.query<JudgeIdentity>(
    "SELECT id, race_id, participant_id, name FROM festival_judge WHERE id = $1",
    [judgeId],
  );
  if (rows.length === 0) throw new AppError(401, "Судья больше не существует");
  return rows[0];
}

export function signJudgeToken(judge: JudgeIdentity): string {
  return jwt.sign(
    { judgeId: judge.id, raceId: judge.race_id, kind: "festival" },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn } as SignOptions,
  );
}

export async function loginJudge(
  pin: string,
): Promise<{ token: string; view: FestivalJudgeView }> {
  const judge = await judgeByPin(pin);
  return { token: signJudgeToken(judge), view: await getJudgeView(judge.id) };
}

async function loadParticipant(id: number): Promise<FestivalParticipant> {
  const { rows } = await pool.query<FestivalParticipant>(
    "SELECT id, number, name, team FROM festival_participant WHERE id = $1",
    [id],
  );
  if (rows.length === 0) throw new AppError(404, "Участник не найден");
  return rows[0];
}

async function ownEvents(participantId: number): Promise<FestivalEvent[]> {
  const { rows } = await pool.query<FestivalEvent>(
    `SELECT id::int, participant_id, kind, station_idx, lap, at
     FROM festival_event WHERE participant_id = $1 ORDER BY at, id`,
    [participantId],
  );
  return rows;
}

async function ownPoints(participantId: number): Promise<FestivalPoint[]> {
  const { rows } = await pool.query<FestivalPoint>(
    `SELECT id::int, participant_id, lap, points, note, at
     FROM festival_point WHERE participant_id = $1 ORDER BY at, id`,
    [participantId],
  );
  return rows;
}

export async function getJudgeView(
  judgeId: number,
): Promise<FestivalJudgeView> {
  const judge = await judgeById(judgeId);
  const race = await loadRace(judge.race_id);
  const [participant, stations, events, points] = await Promise.all([
    loadParticipant(judge.participant_id),
    loadStations(race.id),
    ownEvents(judge.participant_id),
    ownPoints(judge.participant_id),
  ]);

  const prog = progressOf(race, events);
  return {
    race,
    judge: { id: judge.id, name: judge.name },
    participant,
    stations,
    next: nextPoint(race, prog),
    score_lap: prog.lapsClosed > 0 ? prog.lapsClosed : null,
    events,
    points,
    total_points: points.reduce((sum, p) => sum + p.points, 0),
    server_time: new Date().toISOString(),
  };
}

// Отметка приходит вместе с тем, что судья видел на экране. Если состояние
// успело измениться (двойное нажатие, правка админа), точки не совпадут и
// запись не пройдёт — вместо тихого дубля судья получит свежий экран.
export async function markNext(
  judgeId: number,
  expected: FestivalNext,
): Promise<FestivalJudgeView> {
  const judge = await judgeById(judgeId);
  const race = await loadRace(judge.race_id);
  if (!race.started_at) throw new AppError(409, "Гонка ещё не стартовала");
  if (race.finished_at) throw new AppError(409, "Гонка уже завершена");

  const events = await ownEvents(judge.participant_id);
  const next = nextPoint(race, progressOf(race, events));
  if (!next) throw new AppError(409, "Участник уже финишировал");
  if (
    next.kind !== expected.kind ||
    next.lap !== expected.lap ||
    next.station_idx !== expected.station_idx
  ) {
    throw new AppError(409, "Отметка не совпала с состоянием — экран обновлён");
  }

  await pool.query(
    `INSERT INTO festival_event (race_id, participant_id, kind, station_idx, lap, judge_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      race.id,
      judge.participant_id,
      next.kind,
      next.station_idx,
      next.lap,
      judge.id,
    ],
  );
  return getJudgeView(judgeId);
}

// Откат — только последняя своя отметка: снять что-то из середины значило бы
// оставить участника с дырой в порядке рубежей.
export async function undoLastEvent(
  judgeId: number,
): Promise<FestivalJudgeView> {
  const judge = await judgeById(judgeId);
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id::int FROM festival_event WHERE participant_id = $1
     ORDER BY at DESC, id DESC LIMIT 1`,
    [judge.participant_id],
  );
  if (rows.length === 0) throw new AppError(400, "Отменять нечего");
  await pool.query("DELETE FROM festival_event WHERE id = $1", [rows[0].id]);
  return getJudgeView(judgeId);
}

// Баллы зарабатываются на круге и вносятся после его закрытия — поэтому круг
// не выбирается руками, а берётся последний завершённый.
export async function addPoints(
  judgeId: number,
  points: number,
  note: string | null,
): Promise<FestivalJudgeView> {
  const judge = await judgeById(judgeId);
  const race = await loadRace(judge.race_id);
  if (!race.started_at) throw new AppError(409, "Гонка ещё не стартовала");
  if (race.finished_at) throw new AppError(409, "Гонка уже завершена");

  const events = await ownEvents(judge.participant_id);
  const prog = progressOf(race, events);
  if (prog.lapsClosed === 0) {
    throw new AppError(409, "Баллы вносятся после закрытия круга");
  }

  await pool.query(
    `INSERT INTO festival_point (race_id, participant_id, lap, points, note, judge_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [race.id, judge.participant_id, prog.lapsClosed, points, note, judge.id],
  );
  return getJudgeView(judgeId);
}

export async function deleteOwnPoint(
  judgeId: number,
  pointId: number,
): Promise<FestivalJudgeView> {
  const judge = await judgeById(judgeId);
  const { rowCount } = await pool.query(
    "DELETE FROM festival_point WHERE id = $1 AND participant_id = $2",
    [pointId, judge.participant_id],
  );
  if (rowCount === 0) throw new AppError(404, "Балл не найден");
  return getJudgeView(judgeId);
}
