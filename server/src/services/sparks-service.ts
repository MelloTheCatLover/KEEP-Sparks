import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { RankingEntry, SparksSummary } from "../types/sparks";

// Scoring (parity with the old Excel algorithm), all computed at read:
//   per shift:  shift_xp   = SUM(amount * settings.value)
//               person_cnt = COUNT(DISTINCT user) with achievements on the shift
//               difficulty  = round(1 + (1 - exp(-0.03*(person_cnt-10))), 2)
//               coef_xp     = round(shift_xp * difficulty)
//   sparks = SUM(coef_xp) over the child's shifts
//   rank   = RANK() over all children by sparks desc
//
// All children (role 'child') are ranked, even with zero achievements.
const RANKED_CTE = `
  WITH shift_counts AS (
    SELECT shift_id, COUNT(DISTINCT user_id) AS person_count
    FROM achievements
    GROUP BY shift_id
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
