import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  ChildAccount,
  ChildInput,
  CreateChildInput,
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

export async function list(): Promise<ChildAccount[]> {
  const { rows } = await pool.query<ChildAccount>(
    `SELECT ${COLS} FROM user_main WHERE role = 'child' ORDER BY l_name, f_name`,
  );
  return rows;
}

export async function create(input: CreateChildInput): Promise<ChildAccount> {
  const passwd = await bcrypt.hash(input.password, 10);
  try {
    const { rows } = await pool.query<ChildAccount>(
      `INSERT INTO user_main (f_name, m_name, l_name, login, passwd, role)
       VALUES ($1, $2, $3, $4, $5, 'child') RETURNING ${COLS}`,
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
       RETURNING ${COLS}`,
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
