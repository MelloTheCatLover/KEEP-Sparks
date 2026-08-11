import { pool } from "../config/db";
import {
  AwardCategory,
  AwardStat,
  CategoryStat,
  CohortStat,
  Distribution,
  LadderStep,
  RankBand,
  RewardAnalytics,
  ShiftStat,
} from "../types/analytics";
import { getRanking } from "./sparks-service";

// К какой группе относится достижение каталога. Деление не по программе
// (реалити/КТБ/КГГ), а по тому, за что реально дают: `team_shared` получает
// каждый в команде за общий результат, `team_personal` — личное отличие внутри
// команды, `base` — просто за то, что приехал. Ради этой границы аналитика и
// затевалась: без неё не видно, чем набирают искры на самом деле.
const CATEGORY: Record<string, AwardCategory> = {
  ktb_stage: "team_shared",
  ktb_winner: "team_shared",
  kgg_cup: "team_shared",
  kgg_winner: "team_shared",
  wake_up_arena_winner: "team_shared",
  ktb_team_best: "team_personal",
  kgg_mvp: "team_personal",
  reality_winner: "reality",
  reality_super_finalist: "reality",
  reality_finalist: "reality",
  reality_plot: "reality",
  reality_leader: "reality",
  stars_winner: "stars",
  stars_finalist: "stars",
  person_of_shift: "personal",
  person_of_day: "personal",
  recognition: "personal",
  day: "base",
};

const TEAM_SHARED = Object.keys(CATEGORY).filter(
  (k) => CATEGORY[k] === "team_shared",
);

// Смены, попадающие в аналитику: те же, что в рейтинге, но без смены-события
// (её награды живут в `event_award`, а не в `achievements`) и без псевдо-смены
// «Архив» (`person_count_override` — её признак: там агрегат за годы, а не
// смена, и он смазал бы и медианы, и долю новичков).
const SCOPE = `si.in_rating AND NOT si.event_mode AND si.person_count_override IS NULL`;

// Первый приезд ребёнка ищется по всей истории, включая «Архив»: тот, кто
// числится в архиве, на смене 83 уже не новичок.
const HISTORY = `si.in_rating AND NOT si.event_mode`;

interface ChildShiftRow {
  shift_id: number;
  user_id: string;
  rookie: boolean;
  xp: number;
  xp_earned: number;
  xp_team: number;
  xp_base: number;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = sorted.length / 2;
  return sorted.length % 2
    ? sorted[Math.floor(mid)]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

// Джини по распределению баллов: 0 — все получили поровну, 1 — всё забрал один.
// Мера «насколько смена вознаграждает верхушку»; считается по возрастающему
// ряду, поэтому вход должен быть отсортирован.
function gini(sorted: number[]): number {
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (n === 0 || sum === 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (i + 1) * sorted[i];
  return round2((2 * weighted) / (n * sum) - (n + 1) / n);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : round1((100 * part) / whole);
}

// Пары «ребёнок × смена» со всеми баллами смены, разложенными по источникам.
// Ростер, а не только отличившиеся: ноль — тоже результат, и без нулей медиана
// смены врёт.
async function childShiftRows(): Promise<ChildShiftRow[]> {
  const { rows } = await pool.query<{
    shift_id: number;
    user_id: string;
    rookie: boolean;
    xp: string;
    xp_earned: string;
    xp_team: string;
    xp_base: string;
  }>(
    `WITH mem AS (
       SELECT m.shift_id, m.user_id, si.start_date
       FROM shift_members m
       JOIN shift_info si ON si.shift_id = m.shift_id AND ${SCOPE}
     ),
     first_seen AS (
       SELECT m.user_id, MIN(si.start_date) AS first_date
       FROM shift_members m
       JOIN shift_info si ON si.shift_id = m.shift_id AND ${HISTORY}
       GROUP BY m.user_id
     )
     SELECT mem.shift_id, mem.user_id,
            (fs.first_date = mem.start_date) AS rookie,
            COALESCE(SUM(a.xp), 0) AS xp,
            COALESCE(SUM(a.xp) FILTER (WHERE s.name <> 'day'), 0) AS xp_earned,
            COALESCE(SUM(a.xp) FILTER (WHERE s.name = ANY($1::text[])), 0)
              AS xp_team,
            COALESCE(SUM(a.xp) FILTER (WHERE s.name = 'day'), 0) AS xp_base
     FROM mem
     JOIN first_seen fs ON fs.user_id = mem.user_id
     LEFT JOIN achievement_xp a
       ON a.user_id = mem.user_id AND a.shift_id = mem.shift_id
     LEFT JOIN settings s ON s.id = a.setting_id
     GROUP BY mem.shift_id, mem.user_id, fs.first_date, mem.start_date`,
    [TEAM_SHARED],
  );
  return rows.map((r) => ({
    shift_id: r.shift_id,
    user_id: r.user_id,
    rookie: r.rookie,
    xp: Number(r.xp),
    xp_earned: Number(r.xp_earned),
    xp_team: Number(r.xp_team),
    xp_base: Number(r.xp_base),
  }));
}

// Каталог в разрезе «сколько стоит и как часто достаётся». `avg_pct_roster` и
// `avg_xp_per_recipient` усредняются по сменам, где награда вообще выдавалась:
// иначе редкие награды (звёзды были на пяти сменах) выглядели бы недоступнее,
// чем они есть.
//
// `value` — цена СЕГОДНЯШНЯЯ (последняя версия из `setting_price`), а баллы
// собраны по ценам, которые действовали на своих сменах. Иначе смена прайса
// задним числом переписала бы историю в отчёте, хотя в искрах она её не
// трогает.
async function awardRows(): Promise<AwardStat[]> {
  const { rows } = await pool.query<{
    key: string;
    value: number;
    units: string;
    xp: string;
    kids: string;
    shifts_present: string;
    avg_pct_roster: string;
    avg_xp_per_recipient: string;
  }>(
    `WITH roster AS (
       SELECT m.shift_id, COUNT(*)::int AS n
       FROM shift_members m
       JOIN shift_info si ON si.shift_id = m.shift_id AND ${SCOPE}
       GROUP BY m.shift_id
     ),
     per_shift AS (
       SELECT s.name AS key, s.value, a.shift_id,
              COUNT(DISTINCT a.user_id)::int AS got,
              SUM(a.amount)::int AS units,
              SUM(a.xp)::int AS xp
       FROM achievement_xp a
       JOIN settings s ON s.id = a.setting_id
       JOIN roster r ON r.shift_id = a.shift_id
       GROUP BY s.name, s.value, a.shift_id
     )
     SELECT p.key, p.value,
            SUM(p.units) AS units,
            SUM(p.xp) AS xp,
            (SELECT COUNT(DISTINCT a.user_id)
             FROM achievements a
             JOIN settings s2 ON s2.id = a.setting_id
             JOIN roster r2 ON r2.shift_id = a.shift_id
             WHERE s2.name = p.key) AS kids,
            COUNT(*) AS shifts_present,
            AVG(100.0 * p.got / r.n) AS avg_pct_roster,
            AVG(p.xp::numeric / p.got) AS avg_xp_per_recipient
     FROM per_shift p
     JOIN roster r ON r.shift_id = p.shift_id
     GROUP BY p.key, p.value
     ORDER BY SUM(p.xp) DESC`,
  );

  const total = rows.reduce((s, r) => s + Number(r.xp), 0);
  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    category: CATEGORY[r.key] ?? "personal",
    units: Number(r.units),
    xp: Number(r.xp),
    pct: pct(Number(r.xp), total),
    kids: Number(r.kids),
    shifts_present: Number(r.shifts_present),
    avg_pct_roster: round1(Number(r.avg_pct_roster)),
    avg_xp_per_recipient: Math.round(Number(r.avg_xp_per_recipient)),
  }));
}

function categoryStats(awards: AwardStat[]): CategoryStat[] {
  const byCat = new Map<AwardCategory, CategoryStat>();
  const total = awards.reduce((s, a) => s + a.xp, 0);
  for (const a of awards) {
    const cur = byCat.get(a.category) ?? {
      category: a.category,
      xp: 0,
      pct: 0,
      units: 0,
      kids: 0,
    };
    cur.xp += a.xp;
    cur.units += a.units;
    // Дети по категории не суммируются точно (один ребёнок может взять две
    // награды одной группы) — берём максимум по группе как «скольких она
    // вообще коснулась».
    cur.kids = Math.max(cur.kids, a.kids);
    byCat.set(a.category, cur);
  }
  return [...byCat.values()]
    .map((c) => ({ ...c, pct: pct(c.xp, total) }))
    .sort((a, b) => b.xp - a.xp);
}

async function shiftStats(rows: ChildShiftRow[]): Promise<ShiftStat[]> {
  const meta = await pool.query<{
    shift_id: number;
    name: string | null;
    start_date: string;
    difficulty: number;
  }>(
    `SELECT si.shift_id, si.name, si.start_date::text,
            ROUND(1 + (1 - EXP(-0.03 * (
              (SELECT COUNT(*) FROM shift_members m WHERE m.shift_id = si.shift_id)
              - 10))), 2)::float8 AS difficulty
     FROM shift_info si
     WHERE ${SCOPE}
     ORDER BY si.shift_id`,
  );

  const byShift = new Map<number, ChildShiftRow[]>();
  for (const r of rows) {
    const list = byShift.get(r.shift_id) ?? [];
    list.push(r);
    byShift.set(r.shift_id, list);
  }

  return meta.rows.map((s) => {
    const list = byShift.get(s.shift_id) ?? [];
    const xp = list.map((r) => r.xp).sort((a, b) => a - b);
    const rookies = list.filter((r) => r.rookie);
    const veterans = list.filter((r) => !r.rookie);
    const totalXp = list.reduce((acc, r) => acc + r.xp, 0);
    return {
      shift_id: s.shift_id,
      name: s.name,
      start_date: s.start_date,
      roster: list.length,
      difficulty: s.difficulty,
      rookies: rookies.length,
      rookie_pct_roster: pct(rookies.length, list.length),
      rookie_pct_xp: pct(
        rookies.reduce((acc, r) => acc + r.xp, 0),
        totalXp,
      ),
      median_rookie: median(rookies.map((r) => r.xp).sort((a, b) => a - b)),
      median_veteran: median(veterans.map((r) => r.xp).sort((a, b) => a - b)),
      median: median(xp),
      max_xp: xp.length ? xp[xp.length - 1] : 0,
      team_pct_xp: pct(
        list.reduce((acc, r) => acc + r.xp_team, 0),
        totalXp,
      ),
      base_pct_xp: pct(
        list.reduce((acc, r) => acc + r.xp_base, 0),
        totalXp,
      ),
      gini: gini(xp),
    };
  });
}

// Новички против опытных. Сравнение идёт по месту ВНУТРИ смены, а не по сырым
// баллам: смены разного размера и разной щедрости, и абсолютные числа между
// ними несопоставимы. `avg_percentile` — доля ростера, которую ребёнок обошёл
// (1 = первый), так что 0.5 означает «ровно середина».
function cohortStats(rows: ChildShiftRow[]): CohortStat[] {
  const byShift = new Map<number, ChildShiftRow[]>();
  for (const r of rows) {
    const list = byShift.get(r.shift_id) ?? [];
    list.push(r);
    byShift.set(r.shift_id, list);
  }

  interface Placed extends ChildShiftRow {
    percentile: number;
    rank: number;
    n: number;
  }
  const placed: Placed[] = [];
  for (const list of byShift.values()) {
    const sorted = [...list].sort((a, b) => b.xp - a.xp);
    const n = sorted.length;
    sorted.forEach((r, i) => {
      // Одинаковые баллы — одно место: иначе нули делились бы по алфавиту.
      const rank = sorted.findIndex((x) => x.xp === r.xp) + 1;
      placed.push({ ...r, rank, n, percentile: n < 2 ? 1 : (n - i - 1) / (n - 1) });
    });
  }

  const build = (cohort: "rookie" | "veteran"): CohortStat => {
    const list = placed.filter((r) => (cohort === "rookie") === r.rookie);
    const n = list.length;
    const xp = list.map((r) => r.xp).sort((a, b) => a - b);
    const earned = list.map((r) => r.xp_earned).sort((a, b) => a - b);
    const share = (f: (r: Placed) => boolean) =>
      pct(list.filter(f).length, n);
    return {
      cohort,
      child_shifts: n,
      median_xp: median(xp),
      p90_xp: percentile(xp, 0.9),
      median_earned: median(earned),
      pct_zero_earned: share((r) => r.xp_earned === 0),
      avg_percentile:
        n === 0
          ? 0
          : round2(list.reduce((s, r) => s + r.percentile, 0) / n),
      pct_top3: share((r) => r.rank <= 3),
      pct_top10: share((r) => r.rank <= Math.ceil(r.n * 0.1)),
      pct_top25: share((r) => r.rank <= Math.ceil(r.n * 0.25)),
      avg_team_xp:
        n === 0 ? 0 : Math.round(list.reduce((s, r) => s + r.xp_team, 0) / n),
      pct_any_team: share((r) => r.xp_team > 0),
    };
  };

  return [build("rookie"), build("veteran")];
}

// Общий рейтинг как лестница: где стоят дети, сколько стоит одно место в каждой
// полосе и что даёт ещё одна смена. Полосы — по фактическому месту, поэтому
// «цена места» наверху и внизу видна раздельно: усреднять их бессмысленно,
// разница на два порядка.
async function distribution(): Promise<Distribution> {
  const ranking = await getRanking(false);
  const sparks = ranking.map((r) => r.sparks).sort((a, b) => a - b);
  const desc = [...sparks].reverse();
  const totalSparks = sparks.reduce((s, v) => s + v, 0);

  const BANDS: { band: string; from: number; to: number }[] = [
    { band: "1–10", from: 1, to: 10 },
    { band: "11–25", from: 11, to: 25 },
    { band: "26–50", from: 26, to: 50 },
    { band: "51–100", from: 51, to: 100 },
    { band: "101–200", from: 101, to: 200 },
    { band: "201+", from: 201, to: desc.length },
  ];
  const bands: RankBand[] = BANDS.filter((b) => b.from <= desc.length).map(
    (b) => {
      const slice = desc.slice(b.from - 1, Math.min(b.to, desc.length));
      const gaps = slice
        .map((v, i) => {
          const next = desc[b.from - 1 + i + 1];
          return next === undefined ? null : v - next;
        })
        .filter((g): g is number => g !== null)
        .sort((a, b2) => a - b2);
      return {
        band: b.band,
        kids: slice.length,
        avg_sparks: Math.round(
          slice.reduce((s, v) => s + v, 0) / Math.max(slice.length, 1),
        ),
        median_gap: median(gaps),
      };
    },
  );

  const attended = await pool.query<{ user_id: string; shifts: number }>(
    `SELECT m.user_id, COUNT(*)::int AS shifts
     FROM shift_members m
     JOIN shift_info si ON si.shift_id = m.shift_id AND ${HISTORY}
     GROUP BY m.user_id`,
  );
  const shiftsByChild = new Map(
    attended.rows.map((r) => [r.user_id, r.shifts]),
  );
  const top25Cut = percentile(sparks, 0.75);
  const byCount = new Map<number, number[]>();
  for (const r of ranking) {
    const k = shiftsByChild.get(r.user_id) ?? 0;
    const list = byCount.get(k) ?? [];
    list.push(r.sparks);
    byCount.set(k, list);
  }
  const ladder: LadderStep[] = [...byCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([shifts, list]) => ({
      shifts,
      kids: list.length,
      median_sparks: median([...list].sort((a, b) => a - b)),
      pct_in_top25: pct(list.filter((v) => v >= top25Cut).length, list.length),
    }));

  const top10 = desc.slice(0, Math.ceil(desc.length * 0.1));
  return {
    children: sparks.length,
    median: median(sparks),
    p75: percentile(sparks, 0.75),
    p90: percentile(sparks, 0.9),
    p99: percentile(sparks, 0.99),
    max: desc[0] ?? 0,
    top10_share: pct(
      top10.reduce((s, v) => s + v, 0),
      totalSparks,
    ),
    gini: gini(sparks),
    bands,
    ladder,
  };
}

export async function getRewardAnalytics(): Promise<RewardAnalytics> {
  const rows = await childShiftRows();
  const awards = await awardRows();
  const shifts = await shiftStats(rows);

  return {
    shifts_counted: shifts.length,
    child_shifts: rows.length,
    total_xp: awards.reduce((s, a) => s + a.xp, 0),
    categories: categoryStats(awards),
    awards,
    shifts,
    cohorts: cohortStats(rows),
    distribution: await distribution(),
  };
}
