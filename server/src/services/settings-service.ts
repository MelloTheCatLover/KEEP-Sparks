import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import { Setting } from "../types/settings";
import { timezone } from "./reveal";

// Праздничное оформление сайта: включается само в дни смены-события (день
// рождения лагеря). Дата считается по лагерной таймзоне, а не по браузеру: у
// ребёнка в телефоне может стоять что угодно.
//
// Гаснет по `festive_until`, если она задана, — праздник длиннее самого дня
// рождения. Пусто — по последний день смены, как и было. Хардкода даты нет.
export async function getFestive(): Promise<{
  festive: boolean;
  name: string | null;
}> {
  const { rows } = await pool.query<{ name: string | null }>(
    `SELECT name FROM shift_info
     WHERE event_mode
       AND (now() AT TIME ZONE $1::text)::date
             BETWEEN start_date AND COALESCE(festive_until, end_date)
     ORDER BY start_date DESC
     LIMIT 1`,
    [timezone()],
  );
  return { festive: rows.length > 0, name: rows[0]?.name ?? null };
}

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
