import { pool } from "../config/db";
import { AppError } from "../middleware/error";

// Режим техобслуживания. Флаг в базе, а не в переменной окружения: включать и
// выключать его нужно на ходу, без пересборки контейнера.
//
// Читается на каждом запросе, поэтому кэшируется на несколько секунд — иначе
// один поход в БД добавлялся бы к каждому вызову API. Задержка в пару секунд
// между нажатием и закрытием сайта роли не играет.
const TTL_MS = 5000;

export interface MaintenanceState {
  maintenance: boolean;
  message: string | null;
}

let cache: { at: number; value: MaintenanceState } | null = null;

export async function getMaintenance(): Promise<MaintenanceState> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const { rows } = await pool.query<MaintenanceState>(
    "SELECT maintenance, message FROM app_state WHERE id = 1",
  );
  const value = rows[0] ?? { maintenance: false, message: null };
  cache = { at: Date.now(), value };
  return value;
}

export async function setMaintenance(
  maintenance: boolean,
  message: string | null,
): Promise<MaintenanceState> {
  const { rows } = await pool.query<MaintenanceState>(
    `INSERT INTO app_state (id, maintenance, message, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE
       SET maintenance = EXCLUDED.maintenance,
           message = EXCLUDED.message,
           updated_at = NOW()
     RETURNING maintenance, message`,
    [maintenance, message],
  );
  cache = { at: Date.now(), value: rows[0] };
  return rows[0];
}

// Пропуска на техобслуживание. Кэш здесь не нужен: список читает только админка,
// а сам флаг гейт берёт тем же запросом, что и роль.
export interface BypassUser {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
}

const BYPASS_COLS = "id, f_name, m_name, l_name, login";

export async function listBypass(): Promise<BypassUser[]> {
  const { rows } = await pool.query<BypassUser>(
    `SELECT ${BYPASS_COLS} FROM user_main
     WHERE role = 'child' AND maintenance_bypass
     ORDER BY l_name, f_name`,
  );
  return rows;
}

// Ищем по «Фамилия Имя», «Имя Фамилия» или логину — админ вводит ребёнка руками,
// а не выбирает из списка на несколько сотен строк. Тёзки не угадываются: две
// подходящие строки — ошибка, пусть уточнит логином.
export async function grantBypass(query: string): Promise<BypassUser> {
  const needle = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (needle === "") {
    throw new AppError(400, "Field 'query' must not be empty");
  }

  const { rows } = await pool.query<BypassUser>(
    `SELECT ${BYPASS_COLS} FROM user_main
     WHERE role = 'child'
       AND (
         lower(l_name || ' ' || f_name) = $1
         OR lower(f_name || ' ' || l_name) = $1
         OR lower(login) = $1
       )`,
    [needle],
  );

  if (rows.length === 0) {
    throw new AppError(404, "Ребёнок не найден");
  }
  if (rows.length > 1) {
    throw new AppError(409, "Нашлось несколько детей — укажите логин");
  }

  await pool.query(
    "UPDATE user_main SET maintenance_bypass = TRUE WHERE id = $1",
    [rows[0].id],
  );
  return rows[0];
}

export async function revokeBypass(userId: string): Promise<void> {
  await pool.query(
    "UPDATE user_main SET maintenance_bypass = FALSE WHERE id = $1",
    [userId],
  );
}
