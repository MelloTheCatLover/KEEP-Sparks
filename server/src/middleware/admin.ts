import { NextFunction, Request, Response } from "express";
import { pool } from "../config/db";
import { AppError } from "./error";

// Роль всегда из БД, не из токена. Для досок, открытых и детям, и админу:
// админу они показываются целиком, ребёнку — только раскрытое.
export async function isAdmin(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ role: string }>(
    "SELECT role FROM user_main WHERE id = $1",
    [userId],
  );
  return rows[0]?.role === "admin";
}

// Reads role from the DB (never the token). Must run after requireAuth.
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, "Not authenticated");
  }

  const { rows } = await pool.query<{ role: string }>(
    "SELECT role FROM user_main WHERE id = $1",
    [req.auth.userId],
  );

  if (rows.length === 0) {
    throw new AppError(401, "User no longer exists");
  }
  if (rows[0].role !== "admin") {
    throw new AppError(403, "Admin role required");
  }

  next();
}
