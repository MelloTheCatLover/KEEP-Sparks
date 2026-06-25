import { Request, Response } from "express";
import * as sparksService from "../services/sparks-service";
import { AppError } from "../middleware/error";

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, "Not authenticated");
  }
  res.json(await sparksService.getSummary(req.auth.userId));
}
