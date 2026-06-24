import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./error";

// JWT carries only identity. Roles are read from the DB per request, never
// trusted from the token.
export interface JwtPayload {
  userId: string;
  login: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.auth = { userId: decoded.userId, login: decoded.login };
    next();
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}
