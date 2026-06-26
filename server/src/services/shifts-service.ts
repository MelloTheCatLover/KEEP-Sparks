import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { ShiftDetail, ShiftRankEntry, ShiftSummary } from "../types/shifts";

// Common select for ShiftSummary, including the person of the shift.
const SHIFT_SUMMARY = `
  SELECT s.shift_id, s.name, s.start_date::text, s.end_date::text,
         (SELECT COUNT(*) FROM shift_members m WHERE m.shift_id = s.shift_id)::int
           AS child_count,
         p.id AS person_user_id, p.f_name AS person_f_name,
         p.m_name AS person_m_name, p.l_name AS person_l_name
  FROM shift_info s
  LEFT JOIN user_main p ON p.id = s.person_of_the_shift
`;

export async function list(): Promise<ShiftSummary[]> {
  const { rows } = await pool.query<ShiftSummary>(
    `${SHIFT_SUMMARY} ORDER BY s.shift_id`,
  );
  return rows;
}

function difficulty(personCount: number): number {
  return Math.round((1 + (1 - Math.exp(-0.03 * (personCount - 10)))) * 100) / 100;
}

// Shift detail with the per-shift ranking: roster children scored by their
// achievements on this shift, times this shift's difficulty.
export async function getDetail(shiftId: number): Promise<ShiftDetail> {
  const meta = await pool.query<ShiftSummary>(
    `${SHIFT_SUMMARY} WHERE s.shift_id = $1`,
    [shiftId],
  );
  if (meta.rows.length === 0) {
    throw new AppError(404, "Shift not found");
  }

  const ranking = await pool.query<ShiftRankEntry>(
    `WITH diff AS (
       SELECT ROUND(1 + (1 - EXP(-0.03 * (COUNT(*) - 10))), 2) AS d
       FROM shift_members WHERE shift_id = $1
     ),
     scores AS (
       SELECT m.user_id,
              ROUND(COALESCE(SUM(a.amount * s.value), 0) * (SELECT d FROM diff))
                AS coef
       FROM shift_members m
       LEFT JOIN achievements a
         ON a.user_id = m.user_id AND a.shift_id = $1
       LEFT JOIN settings s ON s.id = a.setting_id
       WHERE m.shift_id = $1
       GROUP BY m.user_id
     )
     SELECT RANK() OVER (ORDER BY sc.coef DESC)::int AS rank,
            sc.coef::int AS sparks,
            u.id AS user_id, u.f_name, u.m_name, u.l_name, u.login
     FROM scores sc
     JOIN user_main u ON u.id = sc.user_id
     ORDER BY rank, u.l_name, u.f_name`,
    [shiftId],
  );

  return {
    ...meta.rows[0],
    difficulty: difficulty(meta.rows[0].child_count),
    ranking: ranking.rows,
  };
}
