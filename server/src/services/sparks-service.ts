import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  LookupRow,
  OverviewEntry,
  RankingEntry,
  SparksSummary,
} from "../types/sparks";

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
const RANKED_CTE = `
  WITH shift_counts AS (
    SELECT m.shift_id, COUNT(*) AS person_count
    FROM shift_members m
    JOIN shift_info si ON si.shift_id = m.shift_id AND si.in_rating
    GROUP BY m.shift_id
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
  totals AS (
    SELECT u.id AS user_id, COALESCE(SUM(ps.coef_xp), 0) AS sparks
    FROM user_main u
    LEFT JOIN per_shift ps ON ps.user_id = u.id
    WHERE u.role = 'child'
    GROUP BY u.id
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

export async function getSummary(userId: string): Promise<SparksSummary> {
  const { rows } = await pool.query<SparksSummary>(
    `${RANKED_CTE}
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

export async function getRanking(): Promise<RankingEntry[]> {
  const { rows } = await pool.query<RankingEntry>(
    `${RANKED_CTE}
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
export async function getOverview(): Promise<OverviewEntry[]> {
  const { rows } = await pool.query<OverviewEntry>(
    `${RANKED_CTE},
     agg AS (
       SELECT a.user_id, s.name, SUM(a.amount)::int AS amount
       FROM achievements a
       JOIN settings s ON s.id = a.setting_id
       GROUP BY a.user_id, s.name
     )
     SELECT r.rank::int AS rank, r.sparks::int AS sparks, u.id AS user_id,
            u.f_name, u.m_name, u.l_name, u.login,
            COALESCE(
              jsonb_object_agg(agg.name, agg.amount)
                FILTER (WHERE agg.name IS NOT NULL),
              '{}'::jsonb
            ) AS counts
     FROM ranked r
     JOIN user_main u ON u.id = r.user_id
     LEFT JOIN agg ON agg.user_id = u.id
     GROUP BY r.rank, r.sparks, u.id, u.f_name, u.m_name, u.l_name, u.login
     ORDER BY r.rank, u.l_name, u.f_name`,
  );
  return rows;
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
