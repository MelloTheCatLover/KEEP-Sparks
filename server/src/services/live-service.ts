import { PoolClient } from "pg";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  AwardEntry,
  AwardInput,
  AwardKind,
  Contest,
  ContestStanding,
  CupInput,
  DAILY_AWARD_KINDS,
  DayAwardRow,
  FINAL_AWARD_KINDS,
  LIVE_SETTING_KEYS,
  LiveBoard,
  LiveCup,
  LiveDayStatus,
  LiveMember,
  LiveStage,
  LiveTeam,
  StageInput,
  TeamsInput,
} from "../types/live";
import { revealedSql, timezone } from "./reveal";

const AWARD_KINDS: string[] = [...DAILY_AWARD_KINDS, ...FINAL_AWARD_KINDS];
const DAILY: string[] = [...DAILY_AWARD_KINDS];

function assertKind(kind: string): AwardKind {
  if (!AWARD_KINDS.includes(kind)) {
    throw new AppError(400, `Unknown award kind '${kind}'`);
  }
  return kind as AwardKind;
}

function assertContest(contest: string): Contest {
  if (contest !== "ktb" && contest !== "ktp") {
    throw new AppError(400, "contest must be 'ktb' or 'ktp'");
  }
  return contest;
}

async function loadShift(
  client: PoolClient | typeof pool,
  shiftId: number,
): Promise<{ start_date: string; end_date: string; live_mode: boolean }> {
  const { rows } = await client.query<{
    start_date: string;
    end_date: string;
    live_mode: boolean;
  }>(
    `SELECT start_date::text, end_date::text, live_mode
     FROM shift_info WHERE shift_id = $1`,
    [shiftId],
  );
  if (rows.length === 0) throw new AppError(404, "Shift not found");
  return rows[0];
}

// Мутации разрешены только в режиме ведения: у смен, залитых из xlsx, сырых
// фактов нет, и пересчёт стёр бы их достижения.
async function assertLive(client: PoolClient, shiftId: number): Promise<void> {
  const shift = await loadShift(client, shiftId);
  if (!shift.live_mode) {
    throw new AppError(400, "Live mode is off for this shift");
  }
}

function dayCount(start: string, end: string): number {
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms < 0) return 1;
  return Math.floor(ms / 86_400_000) + 1;
}

// ---------------------------------------------------------------- пересчёт

// Победители этапа — команды с максимумом баллов (при равенстве все они).
// Этап без единого положительного балла ещё не подведён и никого не награждает.
function stageWinners(scores: Record<number, number>): number[] {
  const entries = Object.entries(scores).map(
    ([id, pts]) => [Number(id), pts] as const,
  );
  const best = Math.max(0, ...entries.map(([, pts]) => pts));
  if (best <= 0) return [];
  return entries.filter(([, pts]) => pts === best).map(([id]) => id);
}

// Итог контеста: лидер по сумме баллов (КТБ) или по числу кубков (КТП).
// При ничьей победитель не назначается сам — его выбирает админ вручную.
function standing(
  totals: Record<number, number>,
  manualTeamId: number | null,
): ContestStanding {
  const entries = Object.entries(totals).map(
    ([id, n]) => [Number(id), n] as const,
  );
  const best = Math.max(0, ...entries.map(([, n]) => n));
  const leaders =
    best > 0 ? entries.filter(([, n]) => n === best).map(([id]) => id) : [];
  const winner =
    manualTeamId ?? (leaders.length === 1 ? leaders[0] : null);
  return {
    totals,
    leader_team_ids: leaders,
    manual_team_id: manualTeamId,
    winner_team_id: winner,
  };
}

// Идентификаторы команд, этапов и кубков — BIGSERIAL, а pg отдаёт bigint
// строкой. Везде выбираются как `id::int`: иначе ключи Map/объектов оказываются
// строками и молча расходятся с числовыми team_id из расчётов.
// user_id → день смены → ключ достижения → количество. День нужен, потому что
// ребёнку искры открываются по дням; всё, у чего дня нет (итоги реалити, кубки,
// этапы КТБ), относится к последнему дню смены и открывается вместе с ним.
type DayAmounts = Map<string, Map<number, Map<string, number>>>;

function bump(
  acc: DayAmounts,
  userId: string,
  day: number,
  key: string,
  by = 1,
): void {
  let byDay = acc.get(userId);
  if (!byDay) {
    byDay = new Map();
    acc.set(userId, byDay);
  }
  let row = byDay.get(day);
  if (!row) {
    row = new Map();
    byDay.set(day, row);
  }
  row.set(key, (row.get(key) ?? 0) + by);
}

// Суммарные количества по ребёнку за всю смену — то, что ложится в achievements.
function totalsOf(byDay: Map<number, Map<string, number>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of byDay.values()) {
    for (const [key, n] of row) out.set(key, (out.get(key) ?? 0) + n);
  }
  return out;
}

// Переписывает достижения смены по «живым» ключам из сырых фактов. Единственный
// путь, которым ведение попадает в искры: сначала правится факт, потом отсюда —
// achievements. Идемпотентно, гоняется после каждой мутации.
async function recompute(client: PoolClient, shiftId: number): Promise<void> {
  const roster = await client.query<{ user_id: string }>(
    "SELECT user_id FROM shift_members WHERE shift_id = $1",
    [shiftId],
  );
  const members = new Set(roster.rows.map((r) => r.user_id));

  const shift = await loadShift(client, shiftId);
  const lastDay = dayCount(shift.start_date, shift.end_date);

  const amounts: DayAmounts = new Map();

  // День присутствия — всем и автоматически: ребёнок на смене был, значит день
  // ему засчитан, отмечать это руками незачем. Дней на один меньше, чем длина
  // смены: последний — отъезд (так же в сменах, залитых из xlsx: 10 дней → 9).
  for (const uid of members) {
    for (let day = 1; day < lastDay; day += 1) bump(amounts, uid, day, "day");
  }

  // Именные награды: ежедневные суммируются по дням, финальные — 0/1.
  const awards = await client.query<{
    kind: string;
    day_number: number;
    user_id: string;
  }>(
    "SELECT kind, day_number, user_id FROM shift_award WHERE shift_id = $1",
    [shiftId],
  );
  for (const a of awards.rows) {
    if (!members.has(a.user_id)) continue;
    bump(amounts, a.user_id, a.day_number > 0 ? a.day_number : lastDay, a.kind);
  }

  // Каскад реалити: победитель прошёл и суперфинал, и финал; суперфиналист —
  // финал. Проставляется здесь, чтобы админ отмечал только фактический исход.
  for (const byDay of amounts.values()) {
    const totals = totalsOf(byDay);
    const row = byDay.get(lastDay) ?? new Map<string, number>();
    byDay.set(lastDay, row);
    if ((totals.get("reality_winner") ?? 0) > 0) {
      row.set("reality_super_finalist", 1);
      row.set("reality_finalist", 1);
    } else if ((totals.get("reality_super_finalist") ?? 0) > 0) {
      row.set("reality_finalist", 1);
    }
  }

  // Команды и их составы (общие для КТБ и КТП).
  const teamRows = await client.query<{
    id: number;
    contest: Contest;
    user_id: string | null;
  }>(
    `SELECT t.id::int, t.contest, tm.user_id
     FROM shift_team t
     LEFT JOIN shift_team_member tm ON tm.team_id = t.id
     WHERE t.shift_id = $1`,
    [shiftId],
  );
  const teamMembers = new Map<number, string[]>();
  const teamContest = new Map<number, Contest>();
  for (const r of teamRows.rows) {
    teamContest.set(r.id, r.contest);
    if (!teamMembers.has(r.id)) teamMembers.set(r.id, []);
    if (r.user_id && members.has(r.user_id)) {
      teamMembers.get(r.id)!.push(r.user_id);
    }
  }

  // Итоги контестов дня не имеют — они подводятся в конце, поэтому ложатся на
  // последний день смены и открываются ребёнку вместе с ним. У этапа КТБ день
  // свой: этап прошёл в конкретный день, и искры за него уходят с ним же.
  const award = (
    teamId: number | null,
    key: string,
    day = lastDay,
    by = 1,
  ): void => {
    if (teamId === null) return;
    for (const uid of teamMembers.get(teamId) ?? []) {
      bump(amounts, uid, day, key, by);
    }
  };

  // КТБ: каждый подведённый этап даёт ktb_stage команде-победителю, сумма
  // баллов за смену — ktb_winner.
  const stages = await loadStages(client, shiftId);
  const ktbTotals: Record<number, number> = {};
  for (const [id, contest] of teamContest) {
    if (contest === "ktb") ktbTotals[id] = 0;
  }
  for (const st of stages) {
    for (const winner of st.winner_team_ids) {
      award(winner, "ktb_stage", Math.min(st.day_number, lastDay));
    }
    for (const [teamId, pts] of Object.entries(st.scores)) {
      const id = Number(teamId);
      ktbTotals[id] = (ktbTotals[id] ?? 0) + pts;
    }
  }
  const manual = await loadManualWinners(client, shiftId);
  award(standing(ktbTotals, manual.ktb).winner_team_id, "ktb_winner");

  // КТП: кубок выдаётся команде, каждому её участнику пишется kgg_cup;
  // обладатель наибольшего числа кубков — победитель.
  const cups = await client.query<{ team_id: number }>(
    "SELECT team_id::int FROM ktp_cup WHERE shift_id = $1",
    [shiftId],
  );
  const ktpTotals: Record<number, number> = {};
  for (const [id, contest] of teamContest) {
    if (contest === "ktp") ktpTotals[id] = 0;
  }
  for (const c of cups.rows) {
    ktpTotals[c.team_id] = (ktpTotals[c.team_id] ?? 0) + 1;
    award(c.team_id, "kgg_cup");
  }
  award(standing(ktpTotals, manual.ktp).winner_team_id, "kgg_winner");

  // Запись в achievements: сначала снести всё по «живым» ключам, потом залить
  // ненулевое. Так снятая награда действительно исчезает.
  const settings = await client.query<{ id: number; name: string }>(
    "SELECT id, name FROM settings WHERE name = ANY($1::text[])",
    [LIVE_SETTING_KEYS],
  );
  const settingId = new Map(settings.rows.map((r) => [r.name, r.id]));

  await client.query(
    `DELETE FROM achievements
     WHERE shift_id = $1 AND setting_id = ANY($2::int[])`,
    [shiftId, [...settingId.values()]],
  );

  // Одним запросом на таблицу, а не строкой за строкой: день присутствия
  // начисляется каждому за каждый день, и на смене в 40 человек это сотни
  // строк — столько же round-trip'ов до БД (она на другой машине) превращали
  // любую правку в десятки секунд.
  const totalRows: [string, number, number][] = [];
  for (const [userId, byDay] of amounts) {
    for (const [key, amount] of totalsOf(byDay)) {
      const sid = settingId.get(key);
      if (sid === undefined || amount <= 0) continue;
      totalRows.push([userId, sid, amount]);
    }
  }
  if (totalRows.length > 0) {
    await client.query(
      `INSERT INTO achievements (user_id, shift_id, setting_id, amount)
       SELECT u, $1, s, a
       FROM unnest($2::uuid[], $3::int[], $4::int[]) AS t(u, s, a)`,
      [
        shiftId,
        totalRows.map((r) => r[0]),
        totalRows.map((r) => r[1]),
        totalRows.map((r) => r[2]),
      ],
    );
  }

  // Разбивка по дням — она же содержимое карточки «твои искры за вчера».
  // Коэффициент сюда не входит: он пер-смена и накладывается при чтении один
  // раз, к нарастающей сумме. Умножь мы здесь по дням — сумма округлённых
  // приростов разошлась бы с итогом смены.
  await client.query("DELETE FROM shift_day_award WHERE shift_id = $1", [
    shiftId,
  ]);
  const dayRows: [string, number, number, number][] = [];
  for (const [userId, byDay] of amounts) {
    for (const [day, row] of byDay) {
      for (const [key, amount] of row) {
        const sid = settingId.get(key);
        if (sid === undefined || amount <= 0) continue;
        dayRows.push([userId, day, sid, amount]);
      }
    }
  }
  if (dayRows.length > 0) {
    await client.query(
      `INSERT INTO shift_day_award (shift_id, user_id, day_number, setting_id, amount)
       SELECT $1, u, d, s, a
       FROM unnest($2::uuid[], $3::int[], $4::int[], $5::int[]) AS t(u, d, s, a)`,
      [
        shiftId,
        dayRows.map((r) => r[0]),
        dayRows.map((r) => r[1]),
        dayRows.map((r) => r[2]),
        dayRows.map((r) => r[3]),
      ],
    );
  }

  await syncDescriptive(client, shiftId);
}

// Описательные записи, которые читают доски: «человек смены» в shift_info и
// «человек дня» в people_of_the_day. В подсчёте искр не участвуют — только
// повторяют то, что уже проставлено наградами.
async function syncDescriptive(
  client: PoolClient,
  shiftId: number,
): Promise<void> {
  const { rows: person } = await client.query<{ user_id: string }>(
    `SELECT user_id FROM shift_award
     WHERE shift_id = $1 AND kind = 'person_of_shift' AND day_number = 0
     LIMIT 1`,
    [shiftId],
  );
  await client.query(
    "UPDATE shift_info SET person_of_the_shift = $2 WHERE shift_id = $1",
    [shiftId, person[0]?.user_id ?? null],
  );

  await client.query("DELETE FROM people_of_the_day WHERE shift_id = $1", [
    shiftId,
  ]);
  // `people_of_the_day.day_number` — сквозной номер дня лагеря, а не день смены:
  // доска «Человек дня» — это одна лента через все смены (…545 Шеломенцева →
  // 546 первый день следующей). Поэтому к дню смены прибавляется смещение —
  // максимум по сменам, начавшимся раньше.
  //
  // Смещение фиксированное на смену, а не «следующий свободный номер»: иначе
  // человек дня, названный задним числом, сдвинул бы номера уже показанных дней.
  // Дни, за которые никого не назвали, номер просто пропускают — так же, как в
  // залитых из xlsx сменах.
  await client.query(
    `INSERT INTO people_of_the_day (day_number, shift_id, user_id, date)
     SELECT base.n + a.day_number - 1, a.shift_id, a.user_id,
            s.start_date + (a.day_number - 1)
     FROM shift_award a
     JOIN shift_info s ON s.shift_id = a.shift_id
     CROSS JOIN (
       SELECT COALESCE(MAX(p.day_number), 0) + 1 AS n
       FROM people_of_the_day p
       JOIN shift_info ps ON ps.shift_id = p.shift_id
       WHERE ps.start_date < (SELECT start_date FROM shift_info WHERE shift_id = $1)
     ) base
     WHERE a.shift_id = $1 AND a.kind = 'person_of_day' AND a.day_number > 0
     ON CONFLICT DO NOTHING`,
    [shiftId],
  );
}

// ------------------------------------------------------------------ чтение

async function loadStages(
  client: PoolClient | typeof pool,
  shiftId: number,
): Promise<LiveStage[]> {
  const shift = await loadShift(client, shiftId);
  const lastDay = dayCount(shift.start_date, shift.end_date);
  const { rows } = await client.query<{
    id: number;
    number: number;
    title: string | null;
    day_number: number | null;
    team_id: number | null;
    points: number | null;
  }>(
    `SELECT st.id::int, st.number, st.title, st.day_number,
            sc.team_id::int, sc.points
     FROM ktb_stage st
     LEFT JOIN ktb_stage_score sc ON sc.stage_id = st.id
     WHERE st.shift_id = $1
     ORDER BY st.number`,
    [shiftId],
  );

  const byId = new Map<number, LiveStage>();
  for (const r of rows) {
    let s = byId.get(r.id);
    if (!s) {
      s = {
        id: r.id,
        number: r.number,
        title: r.title,
        // День не задан у этапов, заведённых до появления колонки: они
        // подводились в конце смены, туда же и ложатся.
        day_number: r.day_number ?? lastDay,
        scores: {},
        winner_team_ids: [],
      };
      byId.set(r.id, s);
    }
    if (r.team_id !== null) s.scores[r.team_id] = r.points ?? 0;
  }
  const stages = [...byId.values()];
  for (const s of stages) s.winner_team_ids = stageWinners(s.scores);
  return stages;
}

async function loadManualWinners(
  client: PoolClient | typeof pool,
  shiftId: number,
): Promise<Record<Contest, number | null>> {
  const { rows } = await client.query<{ contest: Contest; team_id: number }>(
    "SELECT contest, team_id::int FROM shift_contest_winner WHERE shift_id = $1",
    [shiftId],
  );
  const out: Record<Contest, number | null> = { ktb: null, ktp: null };
  for (const r of rows) out[r.contest] = r.team_id;
  return out;
}

async function loadTeams(
  client: PoolClient | typeof pool,
  shiftId: number,
): Promise<Record<Contest, LiveTeam[]>> {
  const { rows } = await client.query<{
    id: number;
    contest: Contest;
    name: string;
    position: number;
    user_id: string | null;
  }>(
    `SELECT t.id::int, t.contest, t.name, t.position, tm.user_id
     FROM shift_team t
     LEFT JOIN shift_team_member tm ON tm.team_id = t.id
     WHERE t.shift_id = $1
     ORDER BY t.position, t.id`,
    [shiftId],
  );

  const out: Record<Contest, LiveTeam[]> = { ktb: [], ktp: [] };
  const byId = new Map<number, LiveTeam>();
  for (const r of rows) {
    let t = byId.get(r.id);
    if (!t) {
      t = { id: r.id, name: r.name, position: r.position, member_ids: [] };
      byId.set(r.id, t);
      out[r.contest].push(t);
    }
    if (r.user_id) t.member_ids.push(r.user_id);
  }
  return out;
}

// Полное состояние страницы «Ведение» одной смены.
export async function getBoard(shiftId: number): Promise<LiveBoard> {
  const shift = await loadShift(pool, shiftId);

  const members = await pool.query<LiveMember>(
    `SELECT u.id AS user_id, u.f_name, u.m_name, u.l_name, m.number
     FROM shift_members m
     JOIN user_main u ON u.id = m.user_id
     WHERE m.shift_id = $1
     ORDER BY u.l_name, u.f_name`,
    [shiftId],
  );

  const awardRows = await pool.query<{
    kind: AwardKind;
    day_number: number;
    user_id: string;
  }>(
    `SELECT kind, day_number, user_id FROM shift_award
     WHERE shift_id = $1 ORDER BY day_number`,
    [shiftId],
  );
  const awardMap = new Map<string, AwardEntry>();
  for (const r of awardRows.rows) {
    const key = `${r.kind}-${r.day_number}`;
    let e = awardMap.get(key);
    if (!e) {
      e = { kind: r.kind, day_number: r.day_number, user_ids: [] };
      awardMap.set(key, e);
    }
    e.user_ids.push(r.user_id);
  }

  const cups = await pool.query<LiveCup>(
    "SELECT id::int, team_id::int, title FROM ktp_cup WHERE shift_id = $1 ORDER BY id",
    [shiftId],
  );

  const days = await pool.query<LiveDayStatus>(
    `SELECT gs.n AS day_number,
            (si.start_date + (gs.n - 1))::text AS date,
            d.ready_at,
            ${revealedSql("d.ready_at")} AS revealed,
            (SELECT COUNT(DISTINCT da.user_id)::int
             FROM shift_day_award da
             WHERE da.shift_id = si.shift_id AND da.day_number = gs.n)
              AS scored_children
     FROM shift_info si
     CROSS JOIN generate_series(1, (si.end_date - si.start_date + 1)::int) AS gs(n)
     LEFT JOIN shift_day d
       ON d.shift_id = si.shift_id AND d.day_number = gs.n
     WHERE si.shift_id = $1
     ORDER BY gs.n`,
    [shiftId],
  );

  const [teams, stages, manual] = await Promise.all([
    loadTeams(pool, shiftId),
    loadStages(pool, shiftId),
    loadManualWinners(pool, shiftId),
  ]);

  const ktb = await pool.query<{
    reveal_at: string | null;
    reveal_local: string | null;
    opened: number;
  }>(
    `SELECT si.ktb_reveal_at AS reveal_at,
            to_char(si.ktb_reveal_at AT TIME ZONE $2::text, 'YYYY-MM-DD"T"HH24:MI')
              AS reveal_local,
            (SELECT COUNT(*)::int FROM ktb_team_opened o
             WHERE o.shift_id = si.shift_id) AS opened
     FROM shift_info si
     WHERE si.shift_id = $1`,
    [shiftId, timezone()],
  );

  const ktbTotals: Record<number, number> = {};
  for (const t of teams.ktb) ktbTotals[t.id] = 0;
  for (const s of stages) {
    for (const [teamId, pts] of Object.entries(s.scores)) {
      const id = Number(teamId);
      ktbTotals[id] = (ktbTotals[id] ?? 0) + pts;
    }
  }
  const ktpTotals: Record<number, number> = {};
  for (const t of teams.ktp) ktpTotals[t.id] = 0;
  for (const c of cups.rows) {
    ktpTotals[c.team_id] = (ktpTotals[c.team_id] ?? 0) + 1;
  }

  // Достижения традиций, лежащие вне ведения — признак смены, залитой из xlsx.
  const legacy = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM achievements a
     JOIN settings s ON s.id = a.setting_id
     WHERE a.shift_id = $1 AND s.name = ANY($2::text[]) AND a.amount > 0`,
    [shiftId, LIVE_SETTING_KEYS],
  );

  return {
    shift_id: shiftId,
    start_date: shift.start_date,
    end_date: shift.end_date,
    live_mode: shift.live_mode,
    day_count: dayCount(shift.start_date, shift.end_date),
    has_legacy_achievements: !shift.live_mode && Number(legacy.rows[0].n) > 0,
    members: members.rows,
    days: days.rows,
    awards: [...awardMap.values()],
    teams,
    stages,
    cups: cups.rows,
    standings: {
      ktb: standing(ktbTotals, manual.ktb),
      ktp: standing(ktpTotals, manual.ktp),
    },
    ktb_reveal_at: ktb.rows[0].reveal_at,
    ktb_reveal_local: ktb.rows[0].reveal_local,
    ktb_opened_count: ktb.rows[0].opened,
  };
}

// ----------------------------------------------------------------- мутации

// Обёртка: транзакция, проверка режима, пересчёт, свежая доска.
async function mutate(
  shiftId: number,
  fn: (client: PoolClient) => Promise<void>,
): Promise<LiveBoard> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertLive(client, shiftId);
    await fn(client);
    await recompute(client, shiftId);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getBoard(shiftId);
}

// Включение/выключение режима. Включение переписывает достижения традиций из
// сырых фактов (у пустой смены — обнуляет их), поэтому дёргается явной кнопкой.
export async function setLiveMode(
  shiftId: number,
  on: boolean,
): Promise<LiveBoard> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await loadShift(client, shiftId);
    await client.query(
      "UPDATE shift_info SET live_mode = $2 WHERE shift_id = $1",
      [shiftId, on],
    );
    if (on) await recompute(client, shiftId);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getBoard(shiftId);
}

// Заменяет состав одной награды (одного дня, если она ежедневная) целиком.
export async function saveAward(
  shiftId: number,
  input: AwardInput,
): Promise<LiveBoard> {
  const kind = assertKind(input.kind);
  const day = Number(input.day_number) || 0;
  if (DAILY.includes(kind) ? day < 1 : day !== 0) {
    throw new AppError(400, `Bad day_number ${day} for '${kind}'`);
  }

  return mutate(shiftId, async (client) => {
    const roster = await client.query<{ user_id: string }>(
      "SELECT user_id FROM shift_members WHERE shift_id = $1",
      [shiftId],
    );
    const members = new Set(roster.rows.map((r) => r.user_id));
    for (const id of input.user_ids) {
      if (!members.has(id)) {
        throw new AppError(400, `User ${id} is not on this shift`);
      }
    }

    await client.query(
      "DELETE FROM shift_award WHERE shift_id = $1 AND kind = $2 AND day_number = $3",
      [shiftId, kind, day],
    );
    for (const userId of new Set(input.user_ids)) {
      await client.query(
        `INSERT INTO shift_award (shift_id, kind, day_number, user_id)
         VALUES ($1, $2, $3, $4)`,
        [shiftId, kind, day, userId],
      );
    }
  });
}

// Заменяет команды контеста целиком: переданные с id обновляются, новые
// создаются, пропавшие удаляются вместе со своими баллами и кубками (каскад).
export async function saveTeams(
  shiftId: number,
  input: TeamsInput,
): Promise<LiveBoard> {
  const contest = assertContest(input.contest);

  return mutate(shiftId, async (client) => {
    // `id::int` обязателен: без него pg отдаёт bigint строкой, "29" не находится
    // в Set числовых id, и «сохранить как есть» удаляло ВСЕ команды, а следом
    // падало на «Unknown team 29» — правка состава была невозможна в принципе.
    const existing = await client.query<{ id: number }>(
      "SELECT id::int FROM shift_team WHERE shift_id = $1 AND contest = $2",
      [shiftId, contest],
    );
    const keep = new Set(
      input.teams.map((t) => t.id).filter((id): id is number => id !== undefined),
    );
    for (const row of existing.rows) {
      if (!keep.has(row.id)) {
        await client.query("DELETE FROM shift_team WHERE id = $1", [row.id]);
      }
    }

    for (const [i, t] of input.teams.entries()) {
      const name = t.name.trim();
      if (!name) throw new AppError(400, "Team name must not be empty");

      let teamId = t.id;
      if (teamId === undefined) {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO shift_team (shift_id, contest, name, position)
           VALUES ($1, $2, $3, $4) RETURNING id::int`,
          [shiftId, contest, name, i],
        );
        teamId = rows[0].id;
      } else {
        const { rowCount } = await client.query(
          `UPDATE shift_team SET name = $3, position = $4
           WHERE id = $1 AND shift_id = $2 AND contest = $5`,
          [teamId, shiftId, name, i, contest],
        );
        if (!rowCount) throw new AppError(400, `Unknown team ${teamId}`);
        await client.query("DELETE FROM shift_team_member WHERE team_id = $1", [
          teamId,
        ]);
      }

      for (const userId of new Set(t.member_ids)) {
        await client.query(
          `INSERT INTO shift_team_member (team_id, user_id)
           SELECT $1, $2
           WHERE EXISTS (
             SELECT 1 FROM shift_members WHERE shift_id = $3 AND user_id = $2
           )`,
          [teamId, userId, shiftId],
        );
      }
    }
  });
}

// Заменяет этапы КТБ целиком вместе с их баллами.
export async function saveStages(
  shiftId: number,
  stages: StageInput[],
): Promise<LiveBoard> {
  return mutate(shiftId, async (client) => {
    const shift = await loadShift(client, shiftId);
    const lastDay = dayCount(shift.start_date, shift.end_date);
    await client.query("DELETE FROM ktb_stage WHERE shift_id = $1", [shiftId]);
    // Номер = позиция в списке. Админ этапы переставляет и удаляет, а номера
    // при этом должны оставаться сплошными 1..N; вводить их руками значило
    // ловить дубли на UNIQUE (shift_id, number).
    for (const [i, st] of stages.entries()) {
      const number = i + 1;
      const day = st.day_number === null ? lastDay : Number(st.day_number);
      if (!Number.isInteger(day) || day < 1 || day > lastDay) {
        throw new AppError(400, `Bad stage day ${st.day_number}`);
      }
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO ktb_stage (shift_id, number, title, day_number)
         VALUES ($1, $2, $3, $4) RETURNING id::int`,
        [shiftId, number, st.title?.trim() || null, day],
      );
      for (const [teamId, points] of Object.entries(st.scores ?? {})) {
        const pts = Number(points);
        if (!Number.isFinite(pts)) continue;
        await client.query(
          `INSERT INTO ktb_stage_score (stage_id, team_id, points)
           SELECT $1, $2, $3
           WHERE EXISTS (
             SELECT 1 FROM shift_team
             WHERE id = $2 AND shift_id = $4 AND contest = 'ktb'
           )`,
          [rows[0].id, Number(teamId), Math.round(pts), shiftId],
        );
      }
    }
  });
}

// Заменяет список кубков КТП целиком.
export async function saveCups(
  shiftId: number,
  cups: CupInput[],
): Promise<LiveBoard> {
  return mutate(shiftId, async (client) => {
    await client.query("DELETE FROM ktp_cup WHERE shift_id = $1", [shiftId]);
    for (const c of cups) {
      const { rowCount } = await client.query(
        `INSERT INTO ktp_cup (shift_id, team_id, title)
         SELECT $1, $2, $3
         WHERE EXISTS (
           SELECT 1 FROM shift_team
           WHERE id = $2 AND shift_id = $1 AND contest = 'ktp'
         )`,
        [shiftId, Number(c.team_id), c.title?.trim() || null],
      );
      if (!rowCount) throw new AppError(400, `Unknown КТП team ${c.team_id}`);
    }
  });
}

// Кто и что получит за день — предпросмотр перед тем, как отдать искры. Читает
// уже посчитанный `shift_day_award`, поэтому показывает ровно то, что уйдёт
// ребёнку, а не пересказ правил.
//
// Приходят ВСЕ дети ростера, включая тех, кому за день не начислено ничего:
// «пусто» — тоже ответ на вопрос «а Петров что получит».
//
// `delta` считается так же, как в кабинете ребёнка: коэффициент накладывается
// на нарастающую сумму, прирост дня = разница округлённых итогов. Поэтому у
// ребёнка с одинаковым `xp` дельта может отличаться на единицу — так и есть,
// и админ видит настоящее число.
export async function getDayAwards(
  shiftId: number,
  dayNumber: number,
): Promise<DayAwardRow[]> {
  const day = Number(dayNumber);
  if (!Number.isInteger(day) || day < 1) {
    throw new AppError(400, `Bad day_number ${dayNumber}`);
  }
  const shift = await loadShift(pool, shiftId);
  if (day > dayCount(shift.start_date, shift.end_date)) {
    throw new AppError(400, `Day ${day} is beyond the shift`);
  }

  const { rows } = await pool.query<DayAwardRow>(
    `WITH diff AS (
       SELECT ROUND(1 + (1 - EXP(-0.03 * (
                COALESCE(si.person_count_override,
                         (SELECT COUNT(*) FROM shift_members mm
                          WHERE mm.shift_id = si.shift_id)) - 10))), 2) AS k
       FROM shift_info si WHERE si.shift_id = $1
     ),
     xp AS (
       SELECT d.user_id, d.day_number, SUM(d.amount * st.value)::int AS xp
       FROM shift_day_award d
       JOIN settings st ON st.id = d.setting_id
       WHERE d.shift_id = $1
       GROUP BY d.user_id, d.day_number
     ),
     cum AS (
       SELECT user_id,
              COALESCE(SUM(xp) FILTER (WHERE day_number <= $2), 0) AS upto,
              COALESCE(SUM(xp) FILTER (WHERE day_number < $2), 0) AS before
       FROM xp GROUP BY user_id
     ),
     today AS (
       SELECT d.user_id,
              SUM(d.amount * st.value)::int AS xp,
              jsonb_agg(jsonb_build_object('key', st.name, 'amount', d.amount)
                        ORDER BY st.id) AS items
       FROM shift_day_award d
       JOIN settings st ON st.id = d.setting_id
       WHERE d.shift_id = $1 AND d.day_number = $2
       GROUP BY d.user_id
     )
     SELECT u.id AS user_id, u.f_name, u.m_name, u.l_name, m.number,
            COALESCE(t.items, '[]'::jsonb) AS items,
            COALESCE(t.xp, 0) AS xp,
            (ROUND(COALESCE(c.upto, 0) * (SELECT k FROM diff))
             - ROUND(COALESCE(c.before, 0) * (SELECT k FROM diff)))::int AS delta
     FROM shift_members m
     JOIN user_main u ON u.id = m.user_id
     LEFT JOIN cum c ON c.user_id = m.user_id
     LEFT JOIN today t ON t.user_id = m.user_id
     WHERE m.shift_id = $1
     ORDER BY u.l_name, u.f_name`,
    [shiftId, day],
  );
  return rows;
}

// Подвести день: «за этот день всё введено». Пока день не подведён, ребёнок его
// не увидит, сколько бы времени ни прошло. Снятие прячет день обратно — это
// осознанно: значит, админ понял, что ввёл не всё.
export async function setDayReady(
  shiftId: number,
  dayNumber: number,
  ready: boolean,
): Promise<LiveBoard> {
  const day = Number(dayNumber);
  if (!Number.isInteger(day) || day < 1) {
    throw new AppError(400, `Bad day_number ${dayNumber}`);
  }

  return mutate(shiftId, async (client) => {
    const shift = await loadShift(client, shiftId);
    if (day > dayCount(shift.start_date, shift.end_date)) {
      throw new AppError(400, `Day ${day} is beyond the shift`);
    }
    if (!ready) {
      await client.query(
        "DELETE FROM shift_day WHERE shift_id = $1 AND day_number = $2",
        [shiftId, day],
      );
      return;
    }
    // ready_at не переписывается на повторном нажатии: момент раскрытия
    // считается от первого подведения.
    await client.query(
      `INSERT INTO shift_day (shift_id, day_number, ready_at)
       VALUES ($1, $2, now())
       ON CONFLICT (shift_id, day_number) DO NOTHING`,
      [shiftId, day],
    );
  });
}

// Когда дети узнают свои команды КТБ. Приходит «настенным» временем лагеря
// (`2026-07-31T21:00`) и разбирается в таймзоне лагеря, а не браузера админа:
// админ может сидеть в другом часовом поясе, а час назначается лагерный.
//
// Момент правится свободно, в том числе назад и после наступления — тогда
// сундук закрывается обратно. Отметки «уже открыл» при этом не стираются: если
// состав не менялся, повторно показывать анимацию нечего.
export async function setKtbRevealAt(
  shiftId: number,
  local: string | null,
): Promise<LiveBoard> {
  if (local !== null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    throw new AppError(400, `Bad reveal_at '${local}'`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await loadShift(client, shiftId);
    await client.query(
      `UPDATE shift_info
       SET ktb_reveal_at = CASE
             WHEN $2::text IS NULL THEN NULL
             ELSE ($2::text)::timestamp AT TIME ZONE $3::text
           END
       WHERE shift_id = $1`,
      [shiftId, local, timezone()],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getBoard(shiftId);
}

// Ручной выбор победителя контеста — нужен при равенстве баллов/кубков.
// null снимает выбор и возвращает автоматический подсчёт.
export async function setContestWinner(
  shiftId: number,
  contestRaw: string,
  teamId: number | null,
): Promise<LiveBoard> {
  const contest = assertContest(contestRaw);

  return mutate(shiftId, async (client) => {
    await client.query(
      "DELETE FROM shift_contest_winner WHERE shift_id = $1 AND contest = $2",
      [shiftId, contest],
    );
    if (teamId === null) return;
    const { rowCount } = await client.query(
      `INSERT INTO shift_contest_winner (shift_id, contest, team_id)
       SELECT $1, $2, $3
       WHERE EXISTS (
         SELECT 1 FROM shift_team WHERE id = $3 AND shift_id = $1 AND contest = $2
       )`,
      [shiftId, contest, teamId],
    );
    if (!rowCount) throw new AppError(400, `Unknown team ${teamId}`);
  });
}
