import { Request, Response } from "express";
import * as liveService from "../services/live-service";
import * as ktbDraft from "../services/ktb-draft";
import { AppError } from "../middleware/error";
import { CupInput, StageInput, TeamInput } from "../types/live";

function shiftId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError(400, "Bad shift id");
  return id;
}

function strArray(v: unknown, field: string): string[] {
  if (!Array.isArray(v)) throw new AppError(400, `Field '${field}' must be an array`);
  return v.map(String);
}

export async function board(req: Request, res: Response): Promise<void> {
  res.json(await liveService.getBoard(shiftId(req)));
}

export async function setMode(req: Request, res: Response): Promise<void> {
  const on = (req.body as Record<string, unknown>).live_mode;
  if (typeof on !== "boolean") {
    throw new AppError(400, "Field 'live_mode' must be a boolean");
  }
  res.json(await liveService.setLiveMode(shiftId(req), on));
}

export async function saveAward(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  res.json(
    await liveService.saveAward(shiftId(req), {
      kind: String(body.kind ?? "") as never,
      day_number: Number(body.day_number ?? 0),
      user_ids: strArray(body.user_ids, "user_ids"),
    }),
  );
}

export async function saveTeams(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  if (!Array.isArray(body.teams)) {
    throw new AppError(400, "Field 'teams' must be an array");
  }
  const teams = body.teams.map((raw): TeamInput => {
    const t = raw as Record<string, unknown>;
    const id = Number(t.id);
    return {
      id: Number.isInteger(id) && id > 0 ? id : undefined,
      name: String(t.name ?? ""),
      member_ids: strArray(t.member_ids ?? [], "member_ids"),
    };
  });
  res.json(
    await liveService.saveTeams(shiftId(req), {
      contest: String(body.contest ?? "") as never,
      teams,
    }),
  );
}

export async function saveStages(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  if (!Array.isArray(body.stages)) {
    throw new AppError(400, "Field 'stages' must be an array");
  }
  const stages = body.stages.map((raw): StageInput => {
    const s = raw as Record<string, unknown>;
    const scores: Record<number, number> = {};
    for (const [k, v] of Object.entries(
      (s.scores ?? {}) as Record<string, unknown>,
    )) {
      const n = Number(v);
      if (Number.isFinite(n)) scores[Number(k)] = Math.round(n);
    }
    return {
      title: typeof s.title === "string" ? s.title : null,
      day_number:
        s.day_number === null || s.day_number === undefined
          ? null
          : Number(s.day_number),
      scores,
    };
  });
  res.json(await liveService.saveStages(shiftId(req), stages));
}

export async function saveCups(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  if (!Array.isArray(body.cups)) {
    throw new AppError(400, "Field 'cups' must be an array");
  }
  const cups = body.cups.map((raw): CupInput => {
    const c = raw as Record<string, unknown>;
    return {
      team_id: Number(c.team_id),
      title: typeof c.title === "string" ? c.title : null,
    };
  });
  res.json(await liveService.saveCups(shiftId(req), cups));
}

// Предпросмотр выдачи за день: кто и что получит, если отдать искры.
export async function dayAwards(req: Request, res: Response): Promise<void> {
  res.json(
    await liveService.getDayAwards(shiftId(req), Number(req.params.day)),
  );
}

export async function setDayReady(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const day = Number(body.day_number);
  if (!Number.isInteger(day)) {
    throw new AppError(400, "Field 'day_number' must be an integer");
  }
  if (typeof body.ready !== "boolean") {
    throw new AppError(400, "Field 'ready' must be a boolean");
  }
  res.json(await liveService.setDayReady(shiftId(req), day, body.ready));
}

// Черновик раздачи КТБ: ничего не сохраняет, только считает раскладку по
// названиям команд. Сохраняет её обычный PUT .../live/teams тем планом, который
// админ увидел.
export async function ktbPlan(req: Request, res: Response): Promise<void> {
  const names = (req.body as Record<string, unknown>).team_names;
  if (!Array.isArray(names)) {
    throw new AppError(400, "Field 'team_names' must be an array");
  }
  res.json(await ktbDraft.planKtbTeams(shiftId(req), names.map(String)));
}

export async function setKtbReveal(req: Request, res: Response): Promise<void> {
  const raw = (req.body as Record<string, unknown>).reveal_at;
  if (raw !== null && typeof raw !== "string") {
    throw new AppError(400, "Field 'reveal_at' must be a string or null");
  }
  res.json(await liveService.setKtbRevealAt(shiftId(req), raw));
}

export async function setWinner(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const raw = body.team_id;
  const teamId = raw === null || raw === undefined ? null : Number(raw);
  if (teamId !== null && !Number.isInteger(teamId)) {
    throw new AppError(400, "Field 'team_id' must be an integer or null");
  }
  res.json(
    await liveService.setContestWinner(
      shiftId(req),
      String(body.contest ?? ""),
      teamId,
    ),
  );
}
