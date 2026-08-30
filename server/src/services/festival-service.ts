import { randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { pool } from "../config/db";
import { env } from "../config/env";
import { AppError } from "../middleware/error";
import {
  FestivalAdminBoard,
  FestivalBallot,
  FestivalCandidate,
  FestivalPenalty,
  FestivalRaceSettings,
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
  FestivalVoteRow,
  FestivalVoteTally,
} from "../types/festival";

// Фестиваль живёт сам по себе: ни одной таблицы искр здесь нет. Участник —
// номер, а не ребёнок, и его результат никуда, кроме экрана показа, не идёт.
//
// В БД лежат только сырые отметки (`festival_event`) и баллы
// (`festival_point`). Круг, позиция на круге, время и оба рейтинга считаются
// при чтении — как и везде в проекте.

// `pg` отдаёт timestamptz объектом Date, а DTO обещает строку. Пока разница
// не видна в JSON, но в вычислениях Date склеивается в текст без миллисекунд —
// и два разных момента внутри одной секунды становятся неразличимы (места в
// рейтинге тогда делятся поровну на ровном месте). Поэтому время всегда
// приезжает из SQL готовой строкой ISO. В шаблон подставляется только имя
// колонки из кода — пользовательский ввод по-прежнему только параметрами.
const ISO = (col: string): string =>
  `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const RACE_COLUMNS = `id, title, slug, laps, stations, penalty_seconds, heat_size,
  voting_open, results_published,
  ${ISO("started_at")} AS started_at, ${ISO("finished_at")} AS finished_at,
  ${ISO("created_at")} AS created_at`;

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
    `SELECT id, number, name, team, heat, color, finalist FROM festival_participant
     WHERE race_id = $1 ORDER BY number`,
    [raceId],
  );
  return rows;
}

async function loadEvents(raceId: number): Promise<FestivalEvent[]> {
  const { rows } = await pool.query<FestivalEvent>(
    `SELECT id::int, participant_id, kind, station_idx, lap, ${ISO("at")} AS at
     FROM festival_event WHERE race_id = $1 ORDER BY at, id`,
    [raceId],
  );
  return rows;
}

async function loadPoints(raceId: number): Promise<FestivalPoint[]> {
  const { rows } = await pool.query<FestivalPoint>(
    `SELECT id::int, participant_id, lap, points, ${ISO("at")} AS at
     FROM festival_point WHERE race_id = $1 ORDER BY at, id`,
    [raceId],
  );
  return rows;
}

async function loadPenalties(raceId: number): Promise<FestivalPenalty[]> {
  const { rows } = await pool.query<FestivalPenalty>(
    `SELECT id::int, participant_id, lap, ${ISO("at")} AS at
     FROM festival_penalty WHERE race_id = $1 ORDER BY at, id`,
    [raceId],
  );
  return rows;
}

// ------------------------------------------------------------ вычисления

interface Progress {
  started: boolean;
  startAt: string | null;
  lapsClosed: number;
  lap: number; // текущий круг, у финишировавших — последний
  stationsDone: number; // рубежей пройдено на текущем круге
  finished: boolean;
  finishAt: string | null;
  lastAt: string | null;
  marks: number; // сколько всего отметок — этим меряется «кто дальше»
}

// Последовательность жёсткая: старт → рубеж 1 → … → рубеж N → закрытие круга,
// и так `laps` раз. Поэтому состояние участника целиком выводится из количества
// отметок, а «следующая точка» всегда однозначна.
function progressOf(
  race: FestivalRace,
  events: FestivalEvent[],
): Progress {
  const startEvent = events.find((e) => e.kind === "start") ?? null;
  const lapEvents = events.filter((e) => e.kind === "lap");
  const lapsClosed = lapEvents.length;
  const finished = lapsClosed >= race.laps;
  const lap = finished ? race.laps : lapsClosed + 1;
  const stationsDone = finished
    ? race.stations
    : events.filter((e) => e.kind === "station" && e.lap === lap).length;
  const last = events.length > 0 ? events[events.length - 1] : null;

  return {
    started: startEvent !== null,
    startAt: startEvent ? startEvent.at : null,
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
  if (!p.started) return { kind: "start", lap: 1, station_idx: null };
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
// друга. Время личное — от старта, который включил судья участника, до его
// финиша, плюс штрафы. Незакончившие идут после финишировавших: по пройденному
// расстоянию, при равенстве раньше тот, кто быстрее до него добрался.
// Не стартовавшие — в самом низу.
function standingsOf(
  race: FestivalRace,
  participants: FestivalParticipant[],
  events: FestivalEvent[],
  points: FestivalPoint[],
  penalties: FestivalPenalty[],
): FestivalStanding[] {
  const rows = participants.map((p) => {
    const own = events.filter((e) => e.participant_id === p.id);
    const prog = progressOf(race, own);
    const total = points
      .filter((pt) => pt.participant_id === p.id)
      .reduce((sum, pt) => sum + pt.points, 0);
    const penaltyCount = penalties.filter(
      (pen) => pen.participant_id === p.id,
    ).length;
    const penaltySeconds = penaltyCount * race.penalty_seconds;
    const clean =
      prog.finished && prog.startAt && prog.finishAt
        ? seconds(prog.startAt, prog.finishAt)
        : null;

    return {
      participant_id: p.id,
      number: p.number,
      name: p.name,
      team: p.team,
      heat: p.heat,
      color: p.color,
      started: prog.started,
      start_at: prog.startAt,
      lap: prog.lap,
      stations_done: prog.stationsDone,
      finished: prog.finished,
      clean_seconds: clean,
      penalties: penaltyCount,
      penalty_seconds: penaltySeconds,
      total_seconds: clean === null ? null : clean + penaltySeconds,
      last_at: prog.lastAt,
      points: total,
      time_rank: 0,
      points_rank: 0,
      overall_rank: 0,
    };
  });

  // Сколько точек пройдено — общая мера дистанции: рубежи плюс закрытия кругов.
  const marks = (r: FestivalStanding): number =>
    (r.lap - 1) * (race.stations + 1) + r.stations_done;
  // Сколько участник уже бежит: у стартовавших позже часы идут меньше, поэтому
  // на равной дистанции впереди тот, кто прошёл её быстрее.
  const running = (r: FestivalStanding): number =>
    r.start_at && r.last_at ? seconds(r.start_at, r.last_at) : Number.MAX_SAFE_INTEGER;

  const byTime = [...rows].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) {
      return (a.total_seconds ?? 0) - (b.total_seconds ?? 0);
    }
    if (a.started !== b.started) return a.started ? -1 : 1;
    if (marks(a) !== marks(b)) return marks(b) - marks(a);
    if (running(a) !== running(b)) return running(a) - running(b);
    return a.number - b.number;
  });
  const timeRanks = rankBy(byTime, (r) =>
    r.finished
      ? `f:${r.total_seconds}`
      : r.started
        ? `p:${marks(r)}:${running(r)}`
        : "w",
  );

  const byPoints = [...rows].sort(
    (a, b) => b.points - a.points || a.number - b.number,
  );
  const pointRanks = rankBy(byPoints, (r) => String(r.points));

  for (const row of rows) {
    row.time_rank = timeRanks.get(row) ?? 0;
    row.points_rank = pointRanks.get(row) ?? 0;
  }

  // Итог фестиваля — сумма двух мест, меньше значит выше. При равной сумме
  // впереди тот, кто быстрее: гонка бежится на время, баллы судьи добавляют
  // сверху. Полное совпадение делит место, следующее идёт со сдвигом: 1, 2, 2, 4.
  const byOverall = [...rows].sort(
    (a, b) =>
      a.time_rank + a.points_rank - (b.time_rank + b.points_rank) ||
      a.time_rank - b.time_rank ||
      a.number - b.number,
  );
  const overallRanks = rankBy(
    byOverall,
    (r) => `${r.time_rank + r.points_rank}:${r.time_rank}`,
  );
  for (const row of rows) {
    row.overall_rank = overallRanks.get(row) ?? 0;
  }
  return rows;
}

// --------------------------------------------------------------- экраны

export async function getBoardBySlug(slug: string): Promise<FestivalBoard> {
  const race = await loadRaceBySlug(slug);
  const [stations, participants, events, points, penalties] = await Promise.all([
    loadStations(race.id),
    loadParticipants(race.id),
    loadEvents(race.id),
    loadPoints(race.id),
    loadPenalties(race.id),
  ]);

  return {
    race,
    stations,
    standings: standingsOf(race, participants, events, points, penalties),
    server_time: new Date().toISOString(),
  };
}

export async function getAdminBoard(
  raceId: number,
): Promise<FestivalAdminBoard> {
  const race = await loadRace(raceId);
  const [stations, participants, events, points, penalties, votes] =
    await Promise.all([
      loadStations(race.id),
      loadParticipants(race.id),
      loadEvents(race.id),
      loadPoints(race.id),
      loadPenalties(race.id),
      getTally(race.id),
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
    penalties,
    standings: standingsOf(race, participants, events, points, penalties),
    votes,
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
      `INSERT INTO festival_race
         (title, slug, laps, stations, penalty_seconds, heat_size)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${RACE_COLUMNS}`,
      [
        input.title,
        input.slug,
        input.laps,
        input.stations,
        input.penalty_seconds,
        input.heat_size,
      ],
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

// Ростер задаётся целиком: 22 номера с ФИ, командой и именем судьи. Новому
// номеру сразу выпускается судья со своим PIN — раздать перед стартом. У
// номера, который в ростере остался, PIN и цвет прежние: коды раздают один
// раз на фестиваль. Переписать ростер можно, только пока нет ни одной
// отметки: иначе удаление участника унесло бы результаты вместе с ним.
// Группа старта: если её не задали руками, режем ростер по номерам —
// 1–6 первая шестёрка, 7–12 вторая.
function heatOf(row: FestivalRosterRow, heatSize: number): number {
  if (row.heat && row.heat > 0) return row.heat;
  return Math.floor((row.number - 1) / Math.max(1, heatSize)) + 1;
}

export async function setRoster(
  raceId: number,
  rows: FestivalRosterRow[],
): Promise<FestivalAdminBoard> {
  const race = await loadRace(raceId);
  if (rows.length === 0) throw new AppError(400, "Список участников пуст");

  const numbers = new Set(rows.map((r) => r.number));
  if (numbers.size !== rows.length) {
    throw new AppError(400, "Номера участников повторяются");
  }

  const marked = await pool.query<{ count: string }>(
    `SELECT (SELECT COUNT(*) FROM festival_event WHERE race_id = $1)
          + (SELECT COUNT(*) FROM festival_point WHERE race_id = $1)
          + (SELECT COUNT(*) FROM festival_penalty WHERE race_id = $1) AS count`,
    [raceId],
  );
  if (Number(marked.rows[0].count) > 0) {
    throw new AppError(
      409,
      "В гонке уже есть отметки — сначала сбросьте результаты",
    );
  }

  // Кто уже есть в этой гонке. Судья держится за номером: ростер
  // пересохраняют и между попытками — из-за правки одной фамилии нельзя
  // раздавать двадцати судьям новые коды, а тем, кто уже вошёл на телефоне,
  // логиниться заново. Поэтому оставшиеся номера правятся на месте, а не
  // удаляются вместе со своим судьёй, PIN и цветом.
  const { rows: existing } = await pool.query<{ id: number; number: number }>(
    "SELECT id, number FROM festival_participant WHERE race_id = $1",
    [raceId],
  );
  const byNumber = new Map(existing.map((p) => [p.number, p.id]));

  const fresh = await generatePins(
    rows.filter((r) => !byNumber.has(r.number)).length,
  );
  let freshIdx = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Номера, которых в новом ростере нет, уходят вместе с судьями (каскад).
    await client.query(
      "DELETE FROM festival_participant WHERE race_id = $1 AND NOT (number = ANY($2::int[]))",
      [raceId, [...numbers]],
    );
    for (const row of rows) {
      const heat = heatOf(row, race.heat_size);
      const id = byNumber.get(row.number);
      if (id === undefined) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO festival_participant (race_id, number, name, team, heat)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [raceId, row.number, row.name, row.team, heat],
        );
        await client.query(
          `INSERT INTO festival_judge (race_id, participant_id, name, pin)
           VALUES ($1, $2, $3, $4)`,
          [raceId, inserted.rows[0].id, row.judge_name, fresh[freshIdx++]],
        );
        continue;
      }
      await client.query(
        `UPDATE festival_participant SET name = $2, team = $3, heat = $4
         WHERE id = $1`,
        [id, row.name, row.team, heat],
      );
      // PIN не трогаем — меняется только имя судьи в списке.
      const judge = await client.query(
        "UPDATE festival_judge SET name = $2 WHERE participant_id = $1",
        [id, row.judge_name],
      );
      if (judge.rowCount === 0) {
        await client.query(
          `INSERT INTO festival_judge (race_id, participant_id, name, pin)
           VALUES ($1, $2, $3, $4)`,
          [raceId, id, row.judge_name, fresh[freshIdx++]],
        );
      }
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

// «Старт» гонки — это отмашка: с этого момента судьи могут включать отсчёт
// своим участникам. Само время у каждого своё, от его собственного старта.
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
    await client.query("DELETE FROM festival_penalty WHERE race_id = $1", [raceId]);
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

// Настройки гонки правятся на странице по ходу подготовки. Круги и рубежи
// заперты, как только пошли отметки: изменить дистанцию задним числом значит
// сделать уже пройденное бессмысленным.
export async function updateRace(
  raceId: number,
  input: FestivalRaceSettings,
): Promise<FestivalAdminBoard> {
  const race = await loadRace(raceId);
  const marked = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM festival_event WHERE race_id = $1",
    [raceId],
  );
  const hasMarks = Number(marked.rows[0].count) > 0;
  if (hasMarks && (input.laps !== race.laps || input.stations !== race.stations)) {
    throw new AppError(
      409,
      "Круги и рубежи менять нельзя, пока в гонке есть отметки",
    );
  }

  const heatSize = input.heat_size ?? race.heat_size;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE festival_race
       SET title = $2, laps = $3, stations = $4, penalty_seconds = $5, heat_size = $6
       WHERE id = $1`,
      [raceId, input.title, input.laps, input.stations, input.penalty_seconds, heatSize],
    );

    // Рубежи — подписи; при изменении их числа лишние убираем, недостающие
    // заводим с именем по умолчанию.
    await client.query(
      "DELETE FROM festival_station WHERE race_id = $1 AND idx > $2",
      [raceId, input.stations],
    );
    for (let idx = 1; idx <= input.stations; idx++) {
      await client.query(
        `INSERT INTO festival_station (race_id, idx, name) VALUES ($1, $2, $3)
         ON CONFLICT (race_id, idx) DO NOTHING`,
        [raceId, idx, `Рубеж ${idx}`],
      );
    }

    // Размер группы поменялся — пересобираем группы по номерам.
    if (heatSize !== race.heat_size) {
      await client.query(
        "UPDATE festival_participant SET heat = ((number - 1) / $2) + 1 WHERE race_id = $1",
        [raceId, heatSize],
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

// Правка результатов админом. Судья на площадке ошибается или теряет телефон —
// тогда за него доотмечает админ, теми же правилами: следующая точка по
// порядку, откат только с хвоста.
async function participantRace(participantId: number): Promise<{
  race: FestivalRace;
  participantId: number;
}> {
  const { rows } = await pool.query<{ race_id: number }>(
    "SELECT race_id FROM festival_participant WHERE id = $1",
    [participantId],
  );
  if (rows.length === 0) throw new AppError(404, "Участник не найден");
  return { race: await loadRace(rows[0].race_id), participantId };
}

export async function adminMarkNext(
  participantId: number,
): Promise<FestivalAdminBoard> {
  const { race } = await participantRace(participantId);
  const events = await ownEvents(participantId);
  const next = nextPoint(race, progressOf(race, events));
  if (!next) throw new AppError(409, "Участник уже финишировал");

  await pool.query(
    `INSERT INTO festival_event (race_id, participant_id, kind, station_idx, lap)
     VALUES ($1, $2, $3, $4, $5)`,
    [race.id, participantId, next.kind, next.station_idx, next.lap],
  );
  return getAdminBoard(race.id);
}

export async function adminUndoLastEvent(
  participantId: number,
): Promise<FestivalAdminBoard> {
  const { race } = await participantRace(participantId);
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id::int FROM festival_event WHERE participant_id = $1
     ORDER BY at DESC, id DESC LIMIT 1`,
    [participantId],
  );
  if (rows.length === 0) throw new AppError(400, "Отменять нечего");
  await pool.query("DELETE FROM festival_event WHERE id = $1", [rows[0].id]);
  return getAdminBoard(race.id);
}

export async function adminAddPenalty(
  participantId: number,
): Promise<FestivalAdminBoard> {
  const { race } = await participantRace(participantId);
  const prog = progressOf(race, await ownEvents(participantId));
  await pool.query(
    `INSERT INTO festival_penalty (race_id, participant_id, lap) VALUES ($1, $2, $3)`,
    [race.id, participantId, prog.lap],
  );
  return getAdminBoard(race.id);
}

export async function adminUndoLastPenalty(
  participantId: number,
): Promise<FestivalAdminBoard> {
  const { race } = await participantRace(participantId);
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id::int FROM festival_penalty WHERE participant_id = $1
     ORDER BY at DESC, id DESC LIMIT 1`,
    [participantId],
  );
  if (rows.length === 0) throw new AppError(400, "Штрафов нет");
  await pool.query("DELETE FROM festival_penalty WHERE id = $1", [rows[0].id]);
  return getAdminBoard(race.id);
}

// Цвет номера правят двое — админ и судья своего участника, — проверка одна.
function assertHexColor(color: string | null): void {
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new AppError(400, "Цвет должен быть в виде #RRGGBB");
  }
}

// ------------------------------------------------------ голосование зала
//
// Финал фестиваля: на экран выводится QR, зрители открывают бюллетень в
// телефоне и выбирают одного из финалистов. Голос анонимный — в базе лежит
// только ключ устройства, чтобы один телефон не проголосовал дважды.

// Бюллетень публичный: адрес раздаётся QR-кодом, секрета в нём нет. Пока
// голосование закрыто, кандидаты всё равно отдаются — страница показывает
// «голосование ещё не открыто», а не пустой экран.
export async function getBallot(slug: string): Promise<FestivalBallot> {
  const race = await loadRaceBySlug(slug);
  const { rows } = await pool.query<FestivalCandidate>(
    `SELECT id AS participant_id, number, name, team, color
     FROM festival_participant
     WHERE race_id = $1 AND finalist ORDER BY number`,
    [race.id],
  );
  return {
    title: race.title,
    slug: race.slug,
    voting_open: race.voting_open,
    candidates: rows,
  };
}

export async function castVote(
  slug: string,
  participantId: number,
  device: string,
): Promise<void> {
  const race = await loadRaceBySlug(slug);
  if (!race.voting_open) throw new AppError(409, "Голосование закрыто");

  const { rows } = await pool.query<{ finalist: boolean }>(
    "SELECT finalist FROM festival_participant WHERE id = $1 AND race_id = $2",
    [participantId, race.id],
  );
  if (rows.length === 0) throw new AppError(404, "Участник не найден");
  if (!rows[0].finalist) throw new AppError(400, "Этот номер не в финале");

  // Второй голос с того же телефона ловится уникальным ключом, а не проверкой
  // перед вставкой: между SELECT и INSERT влезает соседний запрос.
  try {
    await pool.query(
      "INSERT INTO festival_vote (race_id, participant_id, device) VALUES ($1, $2, $3)",
      [race.id, participantId, device],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new AppError(409, "С этого телефона уже голосовали");
    }
    throw err;
  }
}

export async function getTally(raceId: number): Promise<FestivalVoteTally> {
  const race = await loadRace(raceId);
  const { rows } = await pool.query<FestivalVoteRow>(
    `SELECT p.id AS participant_id, p.number, p.name, p.team, p.color,
            COUNT(v.id)::int AS votes,
            ${ISO("MAX(v.at)")} AS last_at
     FROM festival_participant p
     LEFT JOIN festival_vote v ON v.participant_id = p.id
     WHERE p.race_id = $1 AND p.finalist
     GROUP BY p.id
     ORDER BY COUNT(v.id) DESC, p.number`,
    [race.id],
  );
  return {
    voting_open: race.voting_open,
    total: rows.reduce((sum, r) => sum + r.votes, 0),
    rows,
    server_time: new Date().toISOString(),
  };
}

// Судья смотрит счёт по своей гонке — она берётся из его токена.
export async function getJudgeTally(judgeId: number): Promise<FestivalVoteTally> {
  const judge = await judgeById(judgeId);
  return getTally(judge.race_id);
}

// Состав финала: отмеченные номера целиком заменяют прежний список.
export async function setFinalists(
  raceId: number,
  participantIds: number[],
): Promise<FestivalAdminBoard> {
  await loadRace(raceId);
  await pool.query(
    `UPDATE festival_participant
     SET finalist = (id = ANY($2::int[]))
     WHERE race_id = $1`,
    [raceId, participantIds],
  );
  return getAdminBoard(raceId);
}

// Объявление итогов. Отдельная кнопка, а не автоматика по финишу: после
// последнего участника админ ещё снимает ошибочные отметки и досыпает баллы,
// и до этого момента показывать «итоговое место» зрителям нельзя.
export async function setResultsPublished(
  raceId: number,
  published: boolean,
): Promise<FestivalAdminBoard> {
  await loadRace(raceId);
  await pool.query(
    "UPDATE festival_race SET results_published = $2 WHERE id = $1",
    [raceId, published],
  );
  return getAdminBoard(raceId);
}

export async function setVotingOpen(
  raceId: number,
  open: boolean,
): Promise<FestivalAdminBoard> {
  await loadRace(raceId);
  if (open) {
    const { rows } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM festival_participant WHERE race_id = $1 AND finalist",
      [raceId],
    );
    if (Number(rows[0].count) === 0) {
      throw new AppError(409, "Сначала отметьте финалистов");
    }
  }
  await pool.query("UPDATE festival_race SET voting_open = $2 WHERE id = $1", [
    raceId,
    open,
  ]);
  return getAdminBoard(raceId);
}

// Пересчёт голосов начисто: список финалистов тот же, счёт с нуля.
export async function clearVotes(raceId: number): Promise<FestivalAdminBoard> {
  await loadRace(raceId);
  await pool.query("DELETE FROM festival_vote WHERE race_id = $1", [raceId]);
  return getAdminBoard(raceId);
}

export async function setParticipantColor(
  participantId: number,
  color: string | null,
): Promise<FestivalAdminBoard> {
  assertHexColor(color);
  const { race } = await participantRace(participantId);
  await pool.query("UPDATE festival_participant SET color = $2 WHERE id = $1", [
    participantId,
    color,
  ]);
  return getAdminBoard(race.id);
}

export async function adminAddPoints(
  participantId: number,
  points: number,
): Promise<FestivalAdminBoard> {
  const { race } = await participantRace(participantId);
  const prog = progressOf(race, await ownEvents(participantId));
  await pool.query(
    `INSERT INTO festival_point (race_id, participant_id, lap, points) VALUES ($1, $2, $3, $4)`,
    [race.id, participantId, Math.max(1, prog.lapsClosed), points],
  );
  return getAdminBoard(race.id);
}

export async function deletePenaltyAsAdmin(
  penaltyId: number,
): Promise<FestivalAdminBoard> {
  const { rows } = await pool.query<{ race_id: number }>(
    "SELECT race_id FROM festival_penalty WHERE id = $1",
    [penaltyId],
  );
  if (rows.length === 0) throw new AppError(404, "Штраф не найден");
  await pool.query("DELETE FROM festival_penalty WHERE id = $1", [penaltyId]);
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
    "SELECT id, number, name, team, heat, color FROM festival_participant WHERE id = $1",
    [id],
  );
  if (rows.length === 0) throw new AppError(404, "Участник не найден");
  return rows[0];
}

async function ownEvents(participantId: number): Promise<FestivalEvent[]> {
  const { rows } = await pool.query<FestivalEvent>(
    `SELECT id::int, participant_id, kind, station_idx, lap, ${ISO("at")} AS at
     FROM festival_event WHERE participant_id = $1 ORDER BY at, id`,
    [participantId],
  );
  return rows;
}

async function ownPoints(participantId: number): Promise<FestivalPoint[]> {
  const { rows } = await pool.query<FestivalPoint>(
    `SELECT id::int, participant_id, lap, points, ${ISO("at")} AS at
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
  const [participant, stations, participants, allEvents, allPoints, allPenalties] =
    await Promise.all([
      loadParticipant(judge.participant_id),
      loadStations(race.id),
      loadParticipants(race.id),
      loadEvents(race.id),
      loadPoints(race.id),
      loadPenalties(race.id),
    ]);

  const mine = (id: number): boolean => id === judge.participant_id;
  const events = allEvents.filter((e) => mine(e.participant_id));
  const points = allPoints.filter((p) => mine(p.participant_id));
  const penalties = allPenalties.filter((p) => mine(p.participant_id));
  const standings = standingsOf(
    race,
    participants,
    allEvents,
    allPoints,
    allPenalties,
  );
  const standing = standings.find((s) => mine(s.participant_id));
  if (!standing) throw new AppError(404, "Участник не найден");

  const prog = progressOf(race, events);
  return {
    race,
    judge: { id: judge.id, name: judge.name },
    participant,
    stations,
    standing,
    standings,
    next: nextPoint(race, prog),
    score_lap: prog.lapsClosed > 0 ? prog.lapsClosed : null,
    events,
    points,
    penalties,
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
    `INSERT INTO festival_point (race_id, participant_id, lap, points, judge_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [race.id, judge.participant_id, prog.lapsClosed, points, judge.id],
  );
  return getJudgeView(judgeId);
}

// Штраф вешается на круг, который участник сейчас проходит: к итоговому времени
// он добавит `race.penalty_seconds` секунд.
export async function addPenalty(judgeId: number): Promise<FestivalJudgeView> {
  const judge = await judgeById(judgeId);
  const race = await loadRace(judge.race_id);
  if (!race.started_at) throw new AppError(409, "Гонка ещё не стартовала");
  if (race.finished_at) throw new AppError(409, "Гонка уже завершена");

  const events = await ownEvents(judge.participant_id);
  const prog = progressOf(race, events);
  if (!prog.started) throw new AppError(409, "Участник ещё не стартовал");

  await pool.query(
    `INSERT INTO festival_penalty (race_id, participant_id, lap, judge_id)
     VALUES ($1, $2, $3, $4)`,
    [race.id, judge.participant_id, prog.lap, judge.id],
  );
  return getJudgeView(judgeId);
}

// Цвет своего номера судья выбирает сам: на экране показа рядом идут близкие
// оттенки команд, и найти свой номер проще по цвету, выбранному на месте.
// Чужие участники судье недоступны — правится только его собственный.
export async function setOwnColor(
  judgeId: number,
  color: string | null,
): Promise<FestivalJudgeView> {
  assertHexColor(color);
  const judge = await judgeById(judgeId);
  await pool.query("UPDATE festival_participant SET color = $2 WHERE id = $1", [
    judge.participant_id,
    color,
  ]);
  return getJudgeView(judgeId);
}

export async function undoLastPenalty(
  judgeId: number,
): Promise<FestivalJudgeView> {
  const judge = await judgeById(judgeId);
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id::int FROM festival_penalty WHERE participant_id = $1
     ORDER BY at DESC, id DESC LIMIT 1`,
    [judge.participant_id],
  );
  if (rows.length === 0) throw new AppError(400, "Штрафов нет");
  await pool.query("DELETE FROM festival_penalty WHERE id = $1", [rows[0].id]);
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
