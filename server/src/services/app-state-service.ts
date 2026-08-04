import { pool } from "../config/db";

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
