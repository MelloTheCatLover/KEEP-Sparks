import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { pool } from "../config/db";
import { env } from "../config/env";
import { AppError } from "../middleware/error";
import { AuthResponse, LoginInput, RegisterInput } from "../types/auth";
import { User } from "../types/user";

const SAFE_COLUMNS =
  "id, f_name, m_name, l_name, login, role, created_at, updated_at";

function sign(user: User): string {
  return jwt.sign({ userId: user.id, login: user.login }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  } as SignOptions);
}

// Registration always grants the 'child' role. Admins are promoted manually
// in the DB.
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const exists = await pool.query("SELECT 1 FROM user_main WHERE login = $1", [
    input.login,
  ]);
  if (exists.rowCount && exists.rowCount > 0) {
    throw new AppError(409, "Login already taken");
  }

  const passwd = await bcrypt.hash(input.password, 10);
  const { rows } = await pool.query<User>(
    `INSERT INTO user_main (f_name, m_name, l_name, login, passwd, role)
     VALUES ($1, $2, $3, $4, $5, 'child')
     RETURNING ${SAFE_COLUMNS}`,
    [input.f_name, input.m_name ?? null, input.l_name, input.login, passwd],
  );

  const user = rows[0];
  return { token: sign(user), user };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { rows } = await pool.query<User & { passwd: string }>(
    `SELECT ${SAFE_COLUMNS}, passwd FROM user_main WHERE login = $1`,
    [input.login],
  );

  const row = rows[0];
  if (!row || !(await bcrypt.compare(input.password, row.passwd))) {
    throw new AppError(401, "Invalid login or password");
  }

  const { passwd: _passwd, ...user } = row;
  return { token: sign(user), user };
}

export async function getById(userId: string): Promise<User> {
  const { rows } = await pool.query<User>(
    `SELECT ${SAFE_COLUMNS} FROM user_main WHERE id = $1`,
    [userId],
  );
  if (rows.length === 0) {
    throw new AppError(404, "User not found");
  }
  return rows[0];
}
