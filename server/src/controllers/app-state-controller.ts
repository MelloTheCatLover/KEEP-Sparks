import { Request, Response } from "express";
import * as appState from "../services/app-state-service";
import { AppError } from "../middleware/error";
import { MAINTENANCE_TEXT } from "../middleware/maintenance";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

// Состояние сайта. GET открыт всем без авторизации: заглушку видит и тот, кто
// ещё не вошёл, и клиент спрашивает статус до логина.
export async function state(_req: Request, res: Response): Promise<void> {
  const s = await appState.getMaintenance();
  res.json({
    maintenance: s.maintenance,
    message: s.message?.trim() || MAINTENANCE_TEXT,
  });
}

// Переключение — только админом. Middleware вызываются вручную, потому что
// маршрут висит выше общего гейта техобслуживания: иначе снять флаг было бы
// нечем.
// Оба бросают AppError при отказе, поэтому next() здесь пустой: до следующей
// строки дело доходит только у админа.
async function adminOnly(req: Request, res: Response): Promise<void> {
  requireAuth(req, res, () => {});
  await requireAdmin(req, res, () => {});
}

export async function setMaintenance(req: Request, res: Response): Promise<void> {
  await adminOnly(req, res);

  const body = req.body as Record<string, unknown>;
  if (typeof body.maintenance !== "boolean") {
    throw new AppError(400, "Field 'maintenance' must be a boolean");
  }
  const message =
    typeof body.message === "string" && body.message.trim() !== ""
      ? body.message.trim()
      : null;
  res.json(await appState.setMaintenance(body.maintenance, message));
}

// Пропуска: кто из детей заходит на сайт, пока он закрыт. Маршруты живут выше
// гейта по той же причине, что и переключатель, — админка должна работать в
// закрытом режиме.
export async function listBypass(req: Request, res: Response): Promise<void> {
  await adminOnly(req, res);
  res.json(await appState.listBypass());
}

export async function grantBypass(req: Request, res: Response): Promise<void> {
  await adminOnly(req, res);

  const body = req.body as Record<string, unknown>;
  if (typeof body.query !== "string") {
    throw new AppError(400, "Field 'query' must be a string");
  }
  res.status(201).json(await appState.grantBypass(body.query));
}

export async function revokeBypass(req: Request, res: Response): Promise<void> {
  await adminOnly(req, res);
  await appState.revokeBypass(String(req.params.id));
  res.status(204).end();
}
