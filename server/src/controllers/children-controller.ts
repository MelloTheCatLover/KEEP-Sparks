import { Request, Response } from "express";
import * as childrenService from "../services/children-service";
import { AppError } from "../middleware/error";

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, `Field '${key}' is required`);
  }
  return value.trim();
}

function optStr(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AppError(400, `Field '${key}' must be a string`);
  }
  return value.trim();
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await childrenService.list());
}

export async function overview(_req: Request, res: Response): Promise<void> {
  res.json(await childrenService.overview());
}

export async function setCurrentRating(
  req: Request,
  res: Response,
): Promise<void> {
  const value = (req.body as Record<string, unknown>).value;
  if (typeof value !== "boolean") {
    throw new AppError(400, "Field 'value' must be a boolean");
  }
  await childrenService.setCurrentRating(String(req.params.id), value);
  res.status(204).end();
}

export async function getDetails(req: Request, res: Response): Promise<void> {
  res.json(await childrenService.getDetails(String(req.params.id)));
}

const GENDERS = new Set(["male", "female"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveDetails(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;

  let pers = null;
  const rawPers = body.pers;
  if (rawPers !== undefined && rawPers !== null) {
    const p = rawPers as Record<string, unknown>;
    const gender = str(p, "gender");
    if (!GENDERS.has(gender)) {
      throw new AppError(400, "Field 'gender' must be male or female");
    }
    const dob = str(p, "date_of_birth");
    if (!ISO_DATE.test(dob)) {
      throw new AppError(400, "Field 'date_of_birth' must be YYYY-MM-DD");
    }
    const height = Number(p.height);
    if (!Number.isInteger(height) || height <= 0) {
      throw new AppError(400, "Field 'height' must be a positive integer");
    }
    pers = { gender, date_of_birth: dob, height };
  }

  const rawParents = Array.isArray(body.parents) ? body.parents : [];
  const parents = rawParents.map((raw) => {
    const p = raw as Record<string, unknown>;
    return {
      f_name: str(p, "f_name"),
      m_name: optStr(p, "m_name"),
      l_name: str(p, "l_name"),
      phone_number_1: str(p, "phone_number_1"),
      phone_number_2: optStr(p, "phone_number_2"),
    };
  });

  const rawAllergies = Array.isArray(body.allergies) ? body.allergies : [];
  const allergies = rawAllergies
    .map((a) => (typeof a === "string" ? a.trim() : ""))
    .filter((a) => a !== "");

  res.json(
    await childrenService.saveDetails(String(req.params.id), {
      pers,
      parents,
      allergies,
    }),
  );
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const password = str(body, "password");
  if (password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters");
  }
  const child = await childrenService.create({
    f_name: str(body, "f_name"),
    m_name: optStr(body, "m_name"),
    l_name: str(body, "l_name"),
    login: str(body, "login"),
    password,
  });
  res.status(201).json(child);
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const child = await childrenService.update(String(req.params.id), {
    f_name: str(body, "f_name"),
    m_name: optStr(body, "m_name"),
    l_name: str(body, "l_name"),
    login: str(body, "login"),
  });
  res.json(child);
}

export async function setPassword(req: Request, res: Response): Promise<void> {
  const password = str(req.body as Record<string, unknown>, "password");
  if (password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters");
  }
  await childrenService.setPassword(String(req.params.id), password);
  res.status(204).end();
}

export async function generatePasswords(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = (req.body as Record<string, unknown>).shiftId;
  let shiftId: number | undefined;
  if (raw !== undefined && raw !== null) {
    shiftId = Number(raw);
    if (!Number.isInteger(shiftId)) {
      throw new AppError(400, "Field 'shiftId' must be an integer");
    }
  }
  res.json(await childrenService.generatePasswords(shiftId));
}
