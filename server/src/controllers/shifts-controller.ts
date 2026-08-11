import { Request, Response } from "express";
import * as shiftsService from "../services/shifts-service";
import * as contestsService from "../services/contests-service";
import { AppError } from "../middleware/error";
import { isAdmin } from "../middleware/admin";
import { AchievementEdit, RosterRow, ShiftMetaInput } from "../types/shifts";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await shiftsService.list());
}

export async function contests(_req: Request, res: Response): Promise<void> {
  res.json(await contestsService.getBoard());
}

export async function winners(_req: Request, res: Response): Promise<void> {
  res.json(await shiftsService.getWinners());
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;

  const shift_id = Number(body.shift_id);
  if (!Number.isInteger(shift_id) || shift_id <= 0) {
    throw new AppError(400, "Field 'shift_id' must be a positive integer");
  }
  const start_date = String(body.start_date ?? "");
  const end_date = String(body.end_date ?? "");
  if (!ISO_DATE.test(start_date) || !ISO_DATE.test(end_date)) {
    throw new AppError(400, "Dates must be YYYY-MM-DD");
  }
  if (end_date < start_date) {
    throw new AppError(400, "end_date must not be before start_date");
  }
  const name =
    typeof body.name === "string" && body.name.trim() !== ""
      ? body.name.trim()
      : null;

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  const roster = Array.isArray(body.roster)
    ? body.roster
        .map((raw): RosterRow | null => {
          const r = raw as Record<string, unknown>;
          const rowName = str(r.name);
          if (!rowName) return null;
          const h = Number(r.height);
          return {
            name: rowName,
            gender: str(r.gender),
            date_of_birth: str(r.date_of_birth),
            height: Number.isFinite(h) && h > 0 ? h : null,
            allergy: str(r.allergy),
            parent: str(r.parent),
            phone: str(r.phone),
          };
        })
        .filter((r): r is RosterRow => r !== null)
    : [];
  if (roster.length === 0) {
    throw new AppError(400, "Field 'roster' must be a non-empty list");
  }

  res.status(201).json(
    await shiftsService.createShift({ shift_id, name, start_date, end_date, roster }),
  );
}

// Доску смотрят и дети, и админ. Ребёнку дни ведущейся смены отдаются только
// после «отдать искры», админу — целиком.
export async function peopleOfDay(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, "Not authenticated");
  }
  res.json(await shiftsService.getPeopleOfDay(await isAdmin(req.auth.userId)));
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new AppError(400, "Invalid shift id");
  }
  res.json(await shiftsService.getDetail(id));
}

function shiftId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new AppError(400, "Invalid shift id");
  }
  return id;
}

// Перевыдать номера смене: номера с генерации — снимок, а искры и ростер
// с тех пор могли поменяться.
export async function recomputeNumbers(
  req: Request,
  res: Response,
): Promise<void> {
  res.json(await shiftsService.recomputeNumbers(shiftId(req)));
}

export async function achievements(req: Request, res: Response): Promise<void> {
  res.json(await shiftsService.getAchievements(shiftId(req)));
}

export async function saveAchievements(
  req: Request,
  res: Response,
): Promise<void> {
  const edits = (req.body as Record<string, unknown>).edits;
  if (!Array.isArray(edits)) {
    throw new AppError(400, "Field 'edits' must be an array");
  }
  for (const e of edits as Record<string, unknown>[]) {
    if (typeof e?.user_id !== "string") {
      throw new AppError(400, "Each edit needs a string 'user_id'");
    }
    if (typeof e.setting_id !== "number" || !Number.isInteger(e.setting_id)) {
      throw new AppError(400, "Each edit needs an integer 'setting_id'");
    }
    if (
      typeof e.amount !== "number" ||
      !Number.isInteger(e.amount) ||
      e.amount < 0
    ) {
      throw new AppError(400, "Each edit needs a non-negative integer 'amount'");
    }
  }
  res.json(
    await shiftsService.saveAchievements(
      shiftId(req),
      edits as unknown as AchievementEdit[],
    ),
  );
}

export async function addMembers(req: Request, res: Response): Promise<void> {
  const names = (req.body as Record<string, unknown>).names;
  if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
    throw new AppError(400, "Field 'names' must be an array of strings");
  }
  res.json(await shiftsService.addMembers(shiftId(req), names as string[]));
}

export async function updateMeta(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const fields: ShiftMetaInput = {};

  if ("name" in body) {
    if (body.name !== null && typeof body.name !== "string") {
      throw new AppError(400, "'name' must be a string or null");
    }
    fields.name = body.name as string | null;
  }
  for (const key of ["start_date", "end_date"] as const) {
    if (key in body) {
      if (typeof body[key] !== "string") {
        throw new AppError(400, `'${key}' must be a date string`);
      }
      fields[key] = body[key] as string;
    }
  }
  if ("in_rating" in body) {
    if (typeof body.in_rating !== "boolean") {
      throw new AppError(400, "'in_rating' must be a boolean");
    }
    fields.in_rating = body.in_rating;
  }
  if ("roster_locked" in body) {
    if (typeof body.roster_locked !== "boolean") {
      throw new AppError(400, "'roster_locked' must be a boolean");
    }
    fields.roster_locked = body.roster_locked;
  }
  if ("person_of_the_shift" in body) {
    if (
      body.person_of_the_shift !== null &&
      typeof body.person_of_the_shift !== "string"
    ) {
      throw new AppError(400, "'person_of_the_shift' must be a uuid or null");
    }
    fields.person_of_the_shift = body.person_of_the_shift as string | null;
  }

  res.json(await shiftsService.updateMeta(shiftId(req), fields));
}

export async function rosterCredentials(
  req: Request,
  res: Response,
): Promise<void> {
  res.json(await shiftsService.getRosterCredentials(shiftId(req)));
}

export async function syncRoster(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const { names, apply } = body;
  if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
    throw new AppError(400, "Field 'names' must be an array of strings");
  }
  if (apply !== undefined && typeof apply !== "boolean") {
    throw new AppError(400, "'apply' must be a boolean");
  }
  res.json(
    await shiftsService.syncRoster(shiftId(req), names as string[], apply === true),
  );
}
