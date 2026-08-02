import { Request, Response } from "express";
import * as eventService from "../services/event-service";
import { AppError } from "../middleware/error";

// Вкладка «День рождения» одной смены. Всё под requireAdmin — награды выдаёт
// только админ, ребёнок видит их через свой кабинет.

function shiftId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError(400, "Invalid shift id");
  return id;
}

function awardId(req: Request): number {
  const id = Number(req.params.awardId);
  if (!Number.isInteger(id)) throw new AppError(400, "Invalid award id");
  return id;
}

export async function board(req: Request, res: Response): Promise<void> {
  res.json(await eventService.getBoard(shiftId(req)));
}

export async function setMode(req: Request, res: Response): Promise<void> {
  const mode = (req.body as Record<string, unknown>).event_mode;
  if (typeof mode !== "boolean") {
    throw new AppError(400, "Field 'event_mode' must be a boolean");
  }
  res.json(await eventService.setEventMode(shiftId(req), mode));
}

export async function addAwards(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const ids = Array.isArray(body.user_ids) ? body.user_ids : null;
  if (!ids || ids.some((v) => typeof v !== "string")) {
    throw new AppError(400, "Field 'user_ids' must be a list of ids");
  }
  if (typeof body.title !== "string") {
    throw new AppError(400, "Field 'title' must be a string");
  }
  res.status(201).json(
    await eventService.addAwards(shiftId(req), {
      user_ids: ids as string[],
      title: body.title,
      amount: Number(body.amount),
      published: body.published === true,
    }),
  );
}

export async function setPublished(req: Request, res: Response): Promise<void> {
  const published = (req.body as Record<string, unknown>).published;
  if (typeof published !== "boolean") {
    throw new AppError(400, "Field 'published' must be a boolean");
  }
  res.json(await eventService.setAwardPublished(awardId(req), published));
}

export async function publishAll(req: Request, res: Response): Promise<void> {
  res.json(await eventService.publishAll(shiftId(req)));
}

export async function deleteAward(req: Request, res: Response): Promise<void> {
  res.json(await eventService.deleteAward(awardId(req)));
}

// Границы розыгрыша: по умолчанию мини-приз 50–350 искр.
function bounds(req: Request): [number, number] {
  const body = req.body as Record<string, unknown>;
  const min = body.min === undefined ? 50 : Number(body.min);
  const max = body.max === undefined ? 350 : Number(body.max);
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new AppError(400, "Fields 'min' and 'max' must be integers");
  }
  return [min, max];
}

export async function draw(req: Request, res: Response): Promise<void> {
  const [min, max] = bounds(req);
  res.json(await eventService.drawPrizes(shiftId(req), min, max));
}

export async function redraw(req: Request, res: Response): Promise<void> {
  const [min, max] = bounds(req);
  res.json(await eventService.redrawPrizes(shiftId(req), min, max));
}

export async function clearDraw(req: Request, res: Response): Promise<void> {
  res.json(await eventService.clearPrizes(shiftId(req)));
}

export async function copyRoster(req: Request, res: Response): Promise<void> {
  const from = Number((req.body as Record<string, unknown>).from_shift_id);
  if (!Number.isInteger(from)) {
    throw new AppError(400, "Field 'from_shift_id' must be an integer");
  }
  res.json(await eventService.copyRoster(shiftId(req), from));
}
