import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  ChildAccount,
  ChildInput,
  CreateChildInput,
  GeneratedCredential,
} from "../types/children";

const COLS = "id, f_name, m_name, l_name, login, created_at";
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}

// Readable random password (no ambiguous chars, ~10 chars).
function makePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function list(): Promise<ChildAccount[]> {
  const { rows } = await pool.query<ChildAccount>(
    `SELECT ${COLS.split(", ")
      .map((c) => `u.${c}`)
      .join(", ")},
       COALESCE(
         array_agg(DISTINCT a.shift_id) FILTER (WHERE a.shift_id IS NOT NULL),
         '{}'
       ) AS shifts
     FROM user_main u
     LEFT JOIN achievements a ON a.user_id = u.id
     WHERE u.role = 'child'
     GROUP BY u.id
     ORDER BY u.l_name, u.f_name`,
  );
  return rows;
}

export async function create(input: CreateChildInput): Promise<ChildAccount> {
  const passwd = await bcrypt.hash(input.password, 10);
  try {
    const { rows } = await pool.query<ChildAccount>(
      `INSERT INTO user_main (f_name, m_name, l_name, login, passwd, role)
       VALUES ($1, $2, $3, $4, $5, 'child')
       RETURNING ${COLS}, '{}'::int[] AS shifts`,
      [input.f_name, input.m_name, input.l_name, input.login, passwd],
    );
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Login already taken");
    throw err;
  }
}

export async function update(
  id: string,
  input: ChildInput,
): Promise<ChildAccount> {
  try {
    const { rows } = await pool.query<ChildAccount>(
      `UPDATE user_main
       SET f_name = $2, m_name = $3, l_name = $4, login = $5
       WHERE id = $1 AND role = 'child'
       RETURNING ${COLS},
         COALESCE(
           (SELECT array_agg(DISTINCT shift_id) FROM achievements WHERE user_id = $1),
           '{}'
         ) AS shifts`,
      [id, input.f_name, input.m_name, input.l_name, input.login],
    );
    if (rows.length === 0) throw new AppError(404, "Child not found");
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Login already taken");
    throw err;
  }
}

export async function setPassword(id: string, password: string): Promise<void> {
  const passwd = await bcrypt.hash(password, 10);
  const { rowCount } = await pool.query(
    "UPDATE user_main SET passwd = $2 WHERE id = $1 AND role = 'child'",
    [id, passwd],
  );
  if (!rowCount) throw new AppError(404, "Child not found");
}

// Reset passwords for all children, or just those on a given shift. Returns the
// plaintext so the admin can hand them out — the only time it is available.
export async function generatePasswords(
  shiftId?: number,
): Promise<GeneratedCredential[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const credCols = "id, f_name, m_name, l_name, login";
    const targets = await client.query<GeneratedCredential>(
      shiftId === undefined
        ? `SELECT ${credCols} FROM user_main WHERE role = 'child'
           ORDER BY l_name, f_name`
        : `SELECT ${credCols} FROM user_main u
           WHERE u.role = 'child'
             AND EXISTS (
               SELECT 1 FROM achievements a
               WHERE a.user_id = u.id AND a.shift_id = $1
             )
           ORDER BY u.l_name, u.f_name`,
      shiftId === undefined ? [] : [shiftId],
    );

    const result: GeneratedCredential[] = [];
    for (const row of targets.rows) {
      const password = makePassword();
      const passwd = await bcrypt.hash(password, 10);
      await client.query("UPDATE user_main SET passwd = $2 WHERE id = $1", [
        row.id,
        passwd,
      ]);
      result.push({ ...row, password });
    }

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
