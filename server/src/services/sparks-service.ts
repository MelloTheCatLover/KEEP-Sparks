import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  BoardEntry,
  ChildBreakdown,
  LiveDay,
  LiveShiftProgress,
  LookupRow,
  MyBreakdown,
  MyShiftStat,
  OverviewEntry,
  RankingEntry,
  SparkAdjustment,
  SparksSummary,
} from "../types/sparks";
import { effectiveRevealSql, nominalRevealSql, revealedSql } from "./reveal";

// Scoring (parity with the old Excel algorithm), all computed at read:
//   per shift:  shift_xp   = SUM(amount * settings.value)
//               person_cnt = roster size (shift_members), incl. zero-scorers
//               difficulty  = round(1 + (1 - exp(-0.03*(person_cnt-10))), 2)
//               coef_xp     = round(shift_xp * difficulty)
//   sparks = SUM(coef_xp) over the child's shifts
//   rank   = RANK() over all children by sparks desc
//
// Only shifts with shift_info.in_rating feed the ranking (e.g. shift 120 is
// excluded). All children (role 'child') are ranked, even with zero score.
//
// The "current" ranking additionally drops children who opted out
// (in_current_rating = false) or have turned 18 (date_of_birth is at least 18
// years ago). Age is evaluated at read — no cron, kids fall out on their
// birthday automatically. Children with no date_of_birth stay (age unknown).
const CURRENT_ONLY_PREDICATE = `
    AND u.in_current_rating
    AND NOT EXISTS (
      SELECT 1 FROM user_pers_info pi
      WHERE pi.user_id = u.id
        AND pi.date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')
    )`;

// Ведущаяся смена (`live_mode`, ещё не `in_rating`) входит в итог ребёнка
// только раскрытыми днями: коэффициент — тот же пер-сменный, округление —
// один раз, после умножения суммы раскрытых дней. Смена, включённая в рейтинг,
// идёт обычным путём через achievements, поэтому задвоения нет.
function rankedCte(currentOnly: boolean): string {
  return `
  WITH shift_counts AS (
    SELECT m.shift_id,
           COALESCE(si.person_count_override, COUNT(*)) AS person_count
    FROM shift_members m
    JOIN shift_info si ON si.shift_id = m.shift_id AND si.in_rating
    GROUP BY m.shift_id, si.person_count_override
  ),
  per_shift AS (
    SELECT
      a.user_id,
      ROUND(
        SUM(a.amount * s.value) *
        ROUND(1 + (1 - EXP(-0.03 * (sc.person_count - 10))), 2)
      ) AS coef_xp
    FROM achievements a
    JOIN settings s ON s.id = a.setting_id
    JOIN shift_counts sc ON sc.shift_id = a.shift_id
    GROUP BY a.user_id, a.shift_id, sc.person_count
  ),
  live_counts AS (
    SELECT m.shift_id,
           COALESCE(si.person_count_override, COUNT(*)) AS person_count
    FROM shift_members m
    JOIN shift_info si
      ON si.shift_id = m.shift_id AND si.live_mode AND NOT si.in_rating
    GROUP BY m.shift_id, si.person_count_override
  ),
  live_per_shift AS (
    SELECT
      d.user_id,
      ROUND(
        SUM(d.amount * st.value) *
        ROUND(1 + (1 - EXP(-0.03 * (lc.person_count - 10))), 2)
      ) AS coef_xp
    FROM shift_day_award d
    JOIN settings st ON st.id = d.setting_id
    JOIN live_counts lc ON lc.shift_id = d.shift_id
    JOIN shift_info si ON si.shift_id = d.shift_id
    LEFT JOIN shift_day sd
      ON sd.shift_id = d.shift_id AND sd.day_number = d.day_number
    WHERE ${revealedSql("si.start_date", "d.day_number", "sd.ready_at")}
    GROUP BY d.user_id, d.shift_id, lc.person_count
  ),
  live_totals AS (
    SELECT user_id, SUM(coef_xp) AS total
    FROM live_per_shift
    GROUP BY user_id
  ),
  adjustments AS (
    SELECT user_id, SUM(amount) AS total
    FROM spark_adjustments
    GROUP BY user_id
  ),
  totals AS (
    SELECT u.id AS user_id,
           COALESCE(SUM(ps.coef_xp), 0)
             + COALESCE(lt.total, 0)
             + COALESCE(adj.total, 0) AS sparks
    FROM user_main u
    LEFT JOIN per_shift ps ON ps.user_id = u.id
    LEFT JOIN live_totals lt ON lt.user_id = u.id
    LEFT JOIN adjustments adj ON adj.user_id = u.id
    WHERE u.role = 'child'${currentOnly ? CURRENT_ONLY_PREDICATE : ""}
    GROUP BY u.id, lt.total, adj.total
  ),
  ranked AS (
    SELECT
      user_id,
      sparks,
      RANK() OVER (ORDER BY sparks DESC) AS rank,
      COUNT(*) OVER () AS total
    FROM totals
  )
`;
}

export async function getSummary(userId: string): Promise<SparksSummary> {
  const { rows } = await pool.query<SparksSummary>(
    `${rankedCte(false)}
     SELECT sparks::int AS sparks, rank::int AS rank, total::int AS total
     FROM ranked WHERE user_id = $1`,
    [userId],
  );
  if (rows.length === 0) {
    // Not a child (admins have no ranking) — sparks are a child-only view.
    throw new AppError(404, "Sparks are available for child accounts only");
  }
  return rows[0];
}

// Child's placement in the current ranking, or null if they are excluded from
// it (turned 18 or opted out). Used to show both places in the personal cabinet.
export async function getCurrentSummary(
  userId: string,
): Promise<SparksSummary | null> {
  const { rows } = await pool.query<SparksSummary>(
    `${rankedCte(true)}
     SELECT sparks::int AS sparks, rank::int AS rank, total::int AS total
     FROM ranked WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

// Public sparks board children see: every child by rank with name and score
// only (no login), oldest-name tiebreak. "current" applies the same exclusions
// as the ranking (18+ / opted out).
export async function getBoard(currentOnly = false): Promise<BoardEntry[]> {
  const { rows } = await pool.query<BoardEntry>(
    `${rankedCte(currentOnly)}
     SELECT r.rank::int AS rank, r.sparks::int AS sparks, u.id AS user_id,
            u.f_name, u.m_name, u.l_name
     FROM ranked r
     JOIN user_main u ON u.id = r.user_id
     ORDER BY r.rank, u.l_name, u.f_name`,
  );
  return rows;
}

export async function getRanking(
  currentOnly = false,
): Promise<RankingEntry[]> {
  const { rows } = await pool.query<RankingEntry>(
    `${rankedCte(currentOnly)}
     SELECT r.rank::int AS rank, r.sparks::int AS sparks, u.id AS user_id,
            u.f_name, u.m_name, u.l_name, u.login
     FROM ranked r
     JOIN user_main u ON u.id = r.user_id
     ORDER BY r.rank, u.l_name, u.f_name`,
  );
  return rows;
}

// Full overview ("Общий рейтинг"): each child with sparks, rank and a per-
// setting breakdown of achievement counts. Mirrors the old spreadsheet, but
// every catalogue action is its own column instead of a few summary ones.
export async function getOverview(
  currentOnly = false,
): Promise<OverviewEntry[]> {
  const { rows } = await pool.query<OverviewEntry>(
    `${rankedCte(currentOnly)},
     agg AS (
       SELECT a.user_id, s.name, SUM(a.amount)::int AS amount
       FROM achievements a
       JOIN settings s ON s.id = a.setting_id
       GROUP BY a.user_id, s.name
     )
     SELECT r.rank::int AS rank, r.sparks::int AS sparks, u.id AS user_id,
            u.f_name, u.m_name, u.l_name, u.login,
            u.in_current_rating,
            (pi.date_of_birth IS NOT NULL
              AND pi.date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')) AS is_adult,
            COALESCE(
              jsonb_object_agg(agg.name, agg.amount)
                FILTER (WHERE agg.name IS NOT NULL),
              '{}'::jsonb
            ) AS counts
     FROM ranked r
     JOIN user_main u ON u.id = r.user_id
     LEFT JOIN user_pers_info pi ON pi.user_id = u.id
     LEFT JOIN agg ON agg.user_id = u.id
     GROUP BY r.rank, r.sparks, u.id, u.f_name, u.m_name, u.l_name, u.login,
              u.in_current_rating, pi.date_of_birth
     ORDER BY r.rank, u.l_name, u.f_name`,
  );
  return rows;
}

// Прогресс ведущейся смены глазами ребёнка: раскрытые дни и время следующего
// раскрытия. `revealAll` — для админа, который смотрит карточку ребёнка и
// должен видеть смену целиком, включая ещё закрытые дни.
//
// Округление ровно одно, на самом верху: прирост дня N = round(итог по день N)
// − round(итог по день N−1). Поэтому сумма приростов всегда точно равна
// показанному итогу — ребёнок не увидит «14 + 8 = 23».
export async function getLiveProgress(
  userId: string,
  revealAll = false,
): Promise<LiveShiftProgress | null> {
  const shift = await pool.query<{
    shift_id: number;
    name: string | null;
    start_date: string;
    end_date: string;
    day_count: number;
    difficulty: number;
  }>(
    `SELECT si.shift_id, si.name, si.start_date::text, si.end_date::text,
            (si.end_date - si.start_date + 1)::int AS day_count,
            ROUND(1 + (1 - EXP(-0.03 * (
              COALESCE(
                si.person_count_override,
                (SELECT COUNT(*) FROM shift_members mm WHERE mm.shift_id = si.shift_id)
              ) - 10))), 2)::float8 AS difficulty
     FROM shift_info si
     JOIN shift_members m ON m.shift_id = si.shift_id AND m.user_id = $1
     WHERE si.live_mode AND NOT si.in_rating
     ORDER BY si.shift_id DESC
     LIMIT 1`,
    [userId],
  );
  if (shift.rows.length === 0) return null;
  const s = shift.rows[0];

  const dayRows = await pool.query<{
    day_number: number;
    date: string;
    xp: number;
    opened: boolean;
    items: { key: string; amount: number }[];
  }>(
    `SELECT d.day_number,
            (si.start_date + (d.day_number - 1))::text AS date,
            SUM(d.amount * st.value)::int AS xp,
            (op.user_id IS NOT NULL) AS opened,
            jsonb_agg(jsonb_build_object('key', st.name, 'amount', d.amount)
                      ORDER BY st.id) AS items
     FROM shift_day_award d
     JOIN settings st ON st.id = d.setting_id
     JOIN shift_info si ON si.shift_id = d.shift_id
     LEFT JOIN shift_day sd
       ON sd.shift_id = d.shift_id AND sd.day_number = d.day_number
     LEFT JOIN shift_day_opened op
       ON op.shift_id = d.shift_id AND op.day_number = d.day_number
      AND op.user_id = d.user_id
     WHERE d.shift_id = $1 AND d.user_id = $2
       ${revealAll ? "" : `AND ${revealedSql("si.start_date", "d.day_number", "sd.ready_at")}`}
     GROUP BY d.day_number, si.start_date, op.user_id
     ORDER BY d.day_number`,
    [s.shift_id, userId],
  );

  let cumulative = 0;
  let shown = 0;
  const days: LiveDay[] = dayRows.rows.map((r) => {
    const before = Math.round(cumulative * s.difficulty);
    cumulative += r.xp;
    const after = Math.round(cumulative * s.difficulty);
    shown = after;
    return {
      day_number: r.day_number,
      date: r.date,
      delta: after - before,
      opened: r.opened,
      items: r.items,
    };
  });

  // Ближайший ещё не наступивший момент раскрытия. Дни, которые админ ещё не
  // подвёл, момента не имеют — для них берётся штатный полдень, чтобы отсчёт
  // всё равно шёл и ребёнок не догадывался по таймеру, что день не готов.
  const next = await pool.query<{ at: string }>(
    `SELECT COALESCE(
              ${effectiveRevealSql("si.start_date", "gs.n", "sd.ready_at")},
              ${nominalRevealSql("si.start_date", "gs.n")}
            ) AS at
     FROM shift_info si
     CROSS JOIN generate_series(1, (si.end_date - si.start_date + 1)::int) AS gs(n)
     LEFT JOIN shift_day sd ON sd.shift_id = si.shift_id AND sd.day_number = gs.n
     WHERE si.shift_id = $1
       AND COALESCE(
             ${effectiveRevealSql("si.start_date", "gs.n", "sd.ready_at")},
             ${nominalRevealSql("si.start_date", "gs.n")}
           ) > now()
     ORDER BY at
     LIMIT 1`,
    [s.shift_id],
  );

  // Карточка «твои искры за вчера»: самый свежий раскрытый, но ещё не открытый
  // ребёнком день. Пустые дни карточку не рождают — открывать нечего.
  const pending = days.filter((d) => !d.opened && d.delta > 0).pop() ?? null;

  return {
    shift_id: s.shift_id,
    name: s.name,
    start_date: s.start_date,
    end_date: s.end_date,
    day_count: s.day_count,
    sparks: shown,
    days,
    pending,
    next_reveal_at: next.rows[0]?.at ?? null,
  };
}

// Ребёнок открыл карточку дня — больше она не всплывает. Отметка серверная:
// с другого устройства карточка не должна прийти второй раз.
export async function markDayOpened(
  userId: string,
  shiftId: number,
  dayNumber: number,
): Promise<LiveShiftProgress | null> {
  await pool.query(
    `INSERT INTO shift_day_opened (shift_id, user_id, day_number)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [shiftId, userId, dayNumber],
  );
  return getLiveProgress(userId);
}

// A child's personal breakdown: per-shift score, placement and achievement
// counts (in_rating shifts only), plus the overall summary. Shifts are oldest
// first so the client can draw a cumulative sparks chart.
export async function getMyBreakdown(
  userId: string,
  revealAll = false,
): Promise<MyBreakdown> {
  const summary = await getSummary(userId);
  const current = await getCurrentSummary(userId);

  const perShift = await pool.query<{
    shift_id: number;
    name: string | null;
    start_date: string;
    end_date: string;
    sparks: number;
    rank: number;
    shift_total: number;
  }>(
    `WITH sc AS (
       SELECT si.shift_id, si.name, si.start_date::text, si.end_date::text,
              m.user_id,
              ROUND(
                COALESCE(SUM(a.amount * s.value), 0) *
                ROUND(1 + (1 - EXP(-0.03 * (
                  COALESCE(
                    si.person_count_override,
                    (SELECT COUNT(*) FROM shift_members mm WHERE mm.shift_id = si.shift_id)
                  ) - 10))), 2)
              ) AS coef
       FROM shift_info si
       JOIN shift_members m ON m.shift_id = si.shift_id
       LEFT JOIN achievements a ON a.user_id = m.user_id AND a.shift_id = si.shift_id
       LEFT JOIN settings s ON s.id = a.setting_id
       WHERE si.in_rating
       GROUP BY si.shift_id, si.name, si.start_date, si.end_date, m.user_id,
                si.person_count_override
     ),
     ranked AS (
       SELECT *,
              RANK() OVER (PARTITION BY shift_id ORDER BY coef DESC)::int AS rank,
              COUNT(*) OVER (PARTITION BY shift_id)::int AS shift_total
       FROM sc
     )
     SELECT shift_id, name, start_date, end_date,
            coef::int AS sparks, rank, shift_total
     FROM ranked
     WHERE user_id = $1
     ORDER BY shift_id`,
    [userId],
  );

  // Per-shift achievement counts for this child.
  const countRows = await pool.query<{
    shift_id: number;
    name: string;
    amount: number;
  }>(
    `SELECT a.shift_id, s.name, SUM(a.amount)::int AS amount
     FROM achievements a
     JOIN settings s ON s.id = a.setting_id
     JOIN shift_info si ON si.shift_id = a.shift_id
     WHERE a.user_id = $1 AND si.in_rating
     GROUP BY a.shift_id, s.name`,
    [userId],
  );
  const countsByShift = new Map<number, Record<string, number>>();
  for (const r of countRows.rows) {
    const m = countsByShift.get(r.shift_id) ?? {};
    m[r.name] = r.amount;
    countsByShift.set(r.shift_id, m);
  }

  const totals: Record<string, number> = {};
  let cumulative = 0;
  const shifts: MyShiftStat[] = perShift.rows.map((r) => {
    cumulative += r.sparks;
    const counts = countsByShift.get(r.shift_id) ?? {};
    for (const [k, v] of Object.entries(counts)) totals[k] = (totals[k] ?? 0) + v;
    return { ...r, cumulative, counts };
  });

  // Only bonuses (positive) are surfaced to the child; penalties stay hidden.
  const bonuses = await pool.query<SparkAdjustment>(
    `SELECT id, user_id, amount, reason, created_at
     FROM spark_adjustments
     WHERE user_id = $1 AND amount > 0
     ORDER BY created_at DESC, id DESC`,
    [userId],
  );

  const live = await getLiveProgress(userId, revealAll);

  return { summary, current, totals, shifts, bonuses: bonuses.rows, live };
}

// Admin: every adjustment (bonuses and penalties) for a child, newest first.
export async function listAdjustments(
  userId: string,
): Promise<SparkAdjustment[]> {
  const { rows } = await pool.query<SparkAdjustment>(
    `SELECT id, user_id, amount, reason, created_at
     FROM spark_adjustments
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId],
  );
  return rows;
}

// Admin: grant a bonus (amount > 0) or penalty (amount < 0) to a child.
export async function addAdjustment(
  userId: string,
  amount: number,
  reason: string | null,
): Promise<SparkAdjustment> {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new AppError(400, "amount must be a non-zero integer");
  }
  const child = await pool.query(
    "SELECT 1 FROM user_main WHERE id = $1 AND role = 'child'",
    [userId],
  );
  if (child.rowCount === 0) throw new AppError(404, "Child not found");

  const { rows } = await pool.query<SparkAdjustment>(
    `INSERT INTO spark_adjustments (user_id, amount, reason)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, amount, reason, created_at`,
    [userId, amount, reason],
  );
  return rows[0];
}

// Admin: delete an adjustment by id.
export async function deleteAdjustment(id: number): Promise<void> {
  const { rowCount } = await pool.query(
    "DELETE FROM spark_adjustments WHERE id = $1",
    [id],
  );
  if (rowCount === 0) throw new AppError(404, "Adjustment not found");
}

// Admin view of any child's dashboard: their breakdown plus name.
export async function getChildBreakdown(id: string): Promise<ChildBreakdown> {
  const u = await pool.query<{
    f_name: string;
    m_name: string | null;
    l_name: string;
  }>(
    "SELECT f_name, m_name, l_name FROM user_main WHERE id = $1 AND role = 'child'",
    [id],
  );
  if (u.rows.length === 0) throw new AppError(404, "Child not found");
  // Админу ведущаяся смена показывается целиком — включая ещё не раскрытые дни.
  return { ...u.rows[0], ...(await getMyBreakdown(id, true)) };
}

// Normalise name parts for matching: lower-case, ё->е, drop blanks.
function nameKey(parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((s) => s.toLowerCase().replace(/ё/g, "е"))
    .join(" ")
    .trim();
}

// Resolve a free-text list of full names (one per line) to their overview
// entries, preserving input order and flagging the ones with no match.
//
// Matching avoids conflating namesakes who differ only by patronymic:
//   - input WITH a patronymic -> strict full-name (surname+first+patronymic)
//     match, so "Минор Таисия Сергеевна" never picks up "…Дмитриевна".
//   - input WITHOUT a patronymic -> surname+first, but only when it is unique
//     in the DB; ambiguous namesakes are left unmatched rather than guessed.
export async function lookupByNames(names: string[]): Promise<LookupRow[]> {
  const overview = await getOverview();
  const byFull = new Map<string, OverviewEntry>();
  const byShort = new Map<string, OverviewEntry[]>();
  for (const e of overview) {
    const full = nameKey([e.l_name, e.f_name, e.m_name ?? ""]);
    if (!byFull.has(full)) byFull.set(full, e);
    const short = nameKey([e.l_name, e.f_name]);
    (byShort.get(short) ?? byShort.set(short, []).get(short)!).push(e);
  }

  return names.map((input) => {
    const parts = input.trim().split(/\s+/);
    const [lName, fName] = parts;
    if (!lName || !fName) return { input, entry: null };

    let entry: OverviewEntry | null;
    if (parts.length >= 3) {
      entry = byFull.get(nameKey(parts)) ?? null;
    } else {
      const group = byShort.get(nameKey([lName, fName])) ?? [];
      entry = group.length === 1 ? group[0] : null;
    }
    return { input, entry };
  });
}
