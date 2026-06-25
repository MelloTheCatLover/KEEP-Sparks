import { Request, Response } from "express";
import * as authService from "../services/auth-service";
import { AppError } from "../middleware/error";
import { LoginInput } from "../types/auth";

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, `Field '${key}' is required`);
  }
  return value.trim();
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
