import { pool } from "../config/db";
import { ShiftSummary } from "../types/shifts";

export async function list(): Promise<ShiftSummary[]> {
  const { rows } = await pool.query<ShiftSummary>(
    `SELECT s.shift_id, s.start_date::text, s.end_date::text,
            COUNT(DISTINCT a.user_id)::int AS child_count
     FROM shift_info s
     LEFT JOIN achievements a ON a.shift_id = s.shift_id
     GROUP BY s.shift_id
     ORDER BY s.shift_id`,
  );
  return rows;
}
