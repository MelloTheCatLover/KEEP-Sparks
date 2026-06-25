import { Request, Response } from "express";
import * as settingsService from "../services/settings-service";
import { AppError } from "../middleware/error";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await settingsService.list());
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new AppError(400, "Invalid setting id");
  }

  const value = (req.body as Record<string, unknown>).value;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AppError(400, "Field 'value' must be a non-negative integer");
  }

  res.json(await settingsService.updateValue(id, value));
}
