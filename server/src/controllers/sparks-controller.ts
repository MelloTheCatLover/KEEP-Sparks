import { Request, Response } from "express";
import * as sparksService from "../services/sparks-service";
import { AppError } from "../middleware/error";

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, "Not authenticated");
  }
  res.json(await sparksService.getSummary(req.auth.userId));
}

export async function myBreakdown(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, "Not authenticated");
  }
  res.json(await sparksService.getMyBreakdown(req.auth.userId));
}

export async function childBreakdown(req: Request, res: Response): Promise<void> {
  res.json(await sparksService.getChildBreakdown(String(req.params.id)));
}

export async function board(req: Request, res: Response): Promise<void> {
  res.json(await sparksService.getBoard(req.query.mode === "current"));
}

export async function ranking(req: Request, res: Response): Promise<void> {
  res.json(await sparksService.getRanking(req.query.mode === "current"));
}

export async function overview(req: Request, res: Response): Promise<void> {
  res.json(await sparksService.getOverview(req.query.mode === "current"));
}

export async function listAdjustments(
  req: Request,
  res: Response,
): Promise<void> {
  res.json(await sparksService.listAdjustments(String(req.params.id)));
}

export async function addAdjustment(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as { amount?: unknown; reason?: unknown };
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount === 0) {
    throw new AppError(400, "Field 'amount' must be a non-zero integer");
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim() !== ""
      ? body.reason.trim()
      : null;
  res
    .status(201)
    .json(
      await sparksService.addAdjustment(String(req.params.id), amount, reason),
    );
}

export async function deleteAdjustment(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params.adjId);
  if (!Number.isInteger(id)) {
    throw new AppError(400, "Invalid adjustment id");
  }
  await sparksService.deleteAdjustment(id);
  res.status(204).end();
}

export async function lookup(req: Request, res: Response): Promise<void> {
  const { names } = req.body as { names?: unknown };
  if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
    throw new AppError(400, "Body must be { names: string[] }");
  }
  res.json(await sparksService.lookupByNames(names as string[]));
}
