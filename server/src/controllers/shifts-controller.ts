import { Request, Response } from "express";
import * as shiftsService from "../services/shifts-service";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await shiftsService.list());
}
