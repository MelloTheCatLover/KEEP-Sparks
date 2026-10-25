import { Request, Response } from "express";
import * as trialsService from "../services/trials-service";
import { AppError } from "../middleware/error";
import { TrialScoreRow } from "../types/trials";

// Вкладка «Испытания» одной смены. Админские ручки — под requireAdmin в
// маршрутах смен; ребёнок видит свои баллы через `/sparks/me/trials`.

function shiftId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError(400, "Invalid shift id");
  return id;
}

function trialId(req: Request): number {
  const id = Number(req.params.trialId);
  if (!Number.isInteger(id)) throw new AppError(400, "Invalid trial id");
  return id;
}

export async function board(req: Request, res: Response): Promise<void> {
  res.json(await trialsService.getBoard(shiftId(req)));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  if (typeof body.title !== "string") {
    throw new AppError(400, "Field 'title' must be a string");
  }
  res
    .status(201)
    .json(
      await trialsService.createTrial(shiftId(req), Number(body.day), body.title),
    );
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const fields: { day?: number; title?: string; published?: boolean } = {};
  if (body.day !== undefined) fields.day = Number(body.day);
  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      throw new AppError(400, "Field 'title' must be a string");
    }
    fields.title = body.title;
  }
  if (body.published !== undefined) {
    if (typeof body.published !== "boolean") {
      throw new AppError(400, "Field 'published' must be a boolean");
    }
    fields.published = body.published;
  }
  res.json(await trialsService.updateTrial(shiftId(req), trialId(req), fields));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await trialsService.deleteTrial(shiftId(req), trialId(req)));
}

// Строки таблицы приходят уже разобранными на клиенте: { number, name, points }.
function parseRows(raw: unknown): TrialScoreRow[] {
  if (!Array.isArray(raw)) {
    throw new AppError(400, "Field 'rows' must be a list");
  }
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    if (o.number !== null && typeof o.number !== "number") {
      throw new AppError(400, "Row 'number' must be a number or null");
    }
    if (typeof o.name !== "string" || typeof o.points !== "number") {
      throw new AppError(400, "Row needs 'name' (string) and 'points' (number)");
    }
    return { number: o.number, name: o.name.trim(), points: o.points };
  });
}

export async function upload(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  res.json(
    await trialsService.uploadScores(
      shiftId(req),
      trialId(req),
      parseRows(body.rows),
      body.apply === true,
    ),
  );
}

export async function mine(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, "Not authenticated");
  res.json(await trialsService.getMyTrials(req.auth.userId));
}
