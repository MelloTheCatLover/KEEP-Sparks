import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";
import { env } from "../config/env";
import { getMaintenance } from "../services/app-state-service";
import { JwtPayload } from "./auth";

export const MAINTENANCE_TEXT =
  "Сайт на техническом обслуживании. Скоро вернёмся — искры никуда не денутся.";

// Пути, живые и на техобслуживании: без входа админ не сможет ни снять флаг,
// ни проверить, что чинил. Заглушке нужен только статус.
const OPEN = new Set(["/api/auth/login", "/api/auth/me", "/api/state"]);

// Закрывает API для всех, кроме админов и детей с пропуском
// (`maintenance_bypass`). Остальные получают 503 с текстом заглушки — клиент по
// этому признаку показывает страницу обслуживания.
//
// Роль читается из базы, а не из токена: токен подписан, но роль в него не
// кладётся (см. requireAuth).
export async function maintenanceGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const state = await getMaintenance();
  if (!state.maintenance) {
    next();
    return;
  }
  if (OPEN.has(req.path)) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(
        header.slice("Bearer ".length),
        env.jwt.secret,
      ) as JwtPayload;
      const { rows } = await pool.query<{
        role: string;
        maintenance_bypass: boolean;
      }>("SELECT role, maintenance_bypass FROM user_main WHERE id = $1", [
        decoded.userId,
      ]);
      if (rows[0]?.role === "admin" || rows[0]?.maintenance_bypass) {
        next();
        return;
      }
    } catch {
      // Просроченный или битый токен — обычный посетитель, попадёт на заглушку.
    }
  }

  res.status(503).json({
    error: state.message?.trim() || MAINTENANCE_TEXT,
    maintenance: true,
  });
}
