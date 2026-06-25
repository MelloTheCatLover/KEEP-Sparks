import { Request, Response } from "express";
import * as childrenService from "../services/children-service";
import { AppError } from "../middleware/error";

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, `Field '${key}' is required`);
  }
  return value.trim();
}

function optStr(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AppError(400, `Field '${key}' must be a string`);
  }
  return value.trim();
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await childrenService.list());
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const password = str(body, "password");
  if (password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters");
  }
  const child = await childrenService.create({
    f_name: str(body, "f_name"),
    m_name: optStr(body, "m_name"),
    l_name: str(body, "l_name"),
    login: str(body, "login"),
    password,
  });
  res.status(201).json(child);
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const child = await childrenService.update(String(req.params.id), {
    f_name: str(body, "f_name"),
    m_name: optStr(body, "m_name"),
    l_name: str(body, "l_name"),
    login: str(body, "login"),
  });
  res.json(child);
}

export async function setPassword(req: Request, res: Response): Promise<void> {
  const password = str(req.body as Record<string, unknown>, "password");
  if (password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters");
  }
  await childrenService.setPassword(String(req.params.id), password);
  res.status(204).end();
}

export async function generatePasswords(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = (req.body as Record<string, unknown>).shiftId;
  let shiftId: number | undefined;
  if (raw !== undefined && raw !== null) {
    shiftId = Number(raw);
    if (!Number.isInteger(shiftId)) {
      throw new AppError(400, "Field 'shiftId' must be an integer");
    }
  }
  res.json(await childrenService.generatePasswords(shiftId));
}
