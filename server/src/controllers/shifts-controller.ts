import { Request, Response } from "express";
import * as shiftsService from "../services/shifts-service";
import { AppError } from "../middleware/error";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await shiftsService.list());
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new AppError(400, "Invalid shift id");
  }
  res.json(await shiftsService.getDetail(id));
}
