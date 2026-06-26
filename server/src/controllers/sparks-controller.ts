import { Request, Response } from "express";
import * as sparksService from "../services/sparks-service";
import { AppError } from "../middleware/error";

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, "Not authenticated");
  }
  res.json(await sparksService.getSummary(req.auth.userId));
}

export async function ranking(_req: Request, res: Response): Promise<void> {
  res.json(await sparksService.getRanking());
}

export async function overview(_req: Request, res: Response): Promise<void> {
  res.json(await sparksService.getOverview());
}
