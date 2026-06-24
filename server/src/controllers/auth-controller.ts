import { Request, Response } from "express";
import * as authService from "../services/auth-service";
import { AppError } from "../middleware/error";
import { LoginInput, RegisterInput } from "../types/auth";

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

export async function register(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const password = str(body, "password");
  if (password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters");
  }

  const input: RegisterInput = {
    f_name: str(body, "f_name"),
    m_name: optStr(body, "m_name"),
    l_name: str(body, "l_name"),
    login: str(body, "login"),
    password,
  };

  res.status(201).json(await authService.register(input));
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const input: LoginInput = {
    login: str(body, "login"),
    password: str(body, "password"),
  };

  res.json(await authService.login(input));
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, "Not authenticated");
  }
  res.json(await authService.getById(req.auth.userId));
}
