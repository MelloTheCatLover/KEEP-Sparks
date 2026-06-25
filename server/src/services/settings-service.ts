import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { Setting } from "../types/settings";

export async function list(): Promise<Setting[]> {
  const { rows } = await pool.query<Setting>(
    "SELECT id, name, value FROM settings ORDER BY id",
  );
  return rows;
}

// Changing a value re-prices every achievement on the next read — sparks are
// never stored, so no recompute job is needed.
export async function updateValue(id: number, value: number): Promise<Setting> {
  const { rows } = await pool.query<Setting>(
    "UPDATE settings SET value = $2 WHERE id = $1 RETURNING id, name, value",
    [id, value],
  );
  if (rows.length === 0) {
    throw new AppError(404, "Setting not found");
  }
  return rows[0];
}
