import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./error";

// Судья фестиваля — не пользователь искр: своей строки в `user_main` у него
// нет, входит он по PIN. Токен подписан тем же секретом, но помечен
// `kind: "festival"`, поэтому судейским токеном нельзя войти в искры, а
// токеном ребёнка или админа — отметить рубеж.
export interface JudgeJwtPayload {
  judgeId: number;
  raceId: number;
  kind: "festival";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      judge?: JudgeJwtPayload;
    }
  }
}

export function requireJudge(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "Нужен код судьи");
  }

  try {
    const decoded = jwt.verify(
      header.slice("Bearer ".length),
      env.jwt.secret,
    ) as Partial<JudgeJwtPayload>;
    if (
      decoded.kind !== "festival" ||
      typeof decoded.judgeId !== "number" ||
      typeof decoded.raceId !== "number"
    ) {
      throw new AppError(401, "Это не судейский код");
    }
    req.judge = {
      judgeId: decoded.judgeId,
      raceId: decoded.raceId,
      kind: "festival",
    };
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "Код судьи просрочен — войдите заново");
  }
}
