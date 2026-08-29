import { Request, Response } from "express";
import * as festivalService from "../services/festival-service";
import { AppError } from "../middleware/error";
import { FestivalNext, FestivalRosterRow } from "../types/festival";

// Фестиваль. Три аудитории: публичный экран показа (только чтение, без
// авторизации), судья (вход по PIN, пишет только своему участнику) и админ
// искр (готовит гонку и правит результаты).

function raceId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError(400, "Invalid race id");
  return id;
}

function rowId(req: Request): number {
  const id = Number(req.params.rowId);
  if (!Number.isInteger(id)) throw new AppError(400, "Invalid id");
  return id;
}

function judgeId(req: Request): number {
  if (!req.judge) throw new AppError(401, "Нужен код судьи");
  return req.judge.judgeId;
}

function str(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, `Поле '${field}' обязательно`);
  }
  if (value.length > max) throw new AppError(400, `Поле '${field}' слишком длинное`);
  return value.trim();
}

function optionalStr(value: unknown, max = 200): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new AppError(400, "Ожидалась строка");
  return value.trim().slice(0, max) || null;
}

function intInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AppError(400, `Поле '${field}' должно быть целым от ${min} до ${max}`);
  }
  return value;
}

// -------------------------------------------------------------- публично

export async function board(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.getBoardBySlug(String(req.params.slug)));
}

// ----------------------------------------------------------------- судья

export async function judgeLogin(req: Request, res: Response): Promise<void> {
  const pin = str((req.body as Record<string, unknown>).pin, "pin", 16);
  res.json(await festivalService.loginJudge(pin));
}

export async function judgeMe(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.getJudgeView(judgeId(req)));
}

export async function judgeMark(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  if (body.kind !== "start" && body.kind !== "station" && body.kind !== "lap") {
    throw new AppError(400, "Поле 'kind' должно быть 'start', 'station' или 'lap'");
  }
  const expected: FestivalNext = {
    kind: body.kind,
    lap: intInRange(body.lap, "lap", 1, 99),
    station_idx:
      body.kind === "station"
        ? intInRange(body.station_idx, "station_idx", 1, 99)
        : null,
  };
  res.json(await festivalService.markNext(judgeId(req), expected));
}

export async function judgeUndo(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.undoLastEvent(judgeId(req)));
}

export async function judgeAddPoints(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const points = intInRange(body.points, "points", -1000, 1000);
  if (points === 0) throw new AppError(400, "Ноль баллов записывать нечего");
  res.json(await festivalService.addPoints(judgeId(req), points));
}

export async function judgeAddPenalty(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.addPenalty(judgeId(req)));
}

export async function judgeUndoPenalty(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.undoLastPenalty(judgeId(req)));
}

export async function judgeDeletePoint(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.deleteOwnPoint(judgeId(req), rowId(req)));
}

// ----------------------------------------------------------------- админ

export async function listRaces(_req: Request, res: Response): Promise<void> {
  res.json(await festivalService.listRaces());
}

export async function adminBoard(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.getAdminBoard(raceId(req)));
}

export async function createRace(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const slug = str(body.slug, "slug", 40).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new AppError(400, "Адрес экрана: только латиница, цифры и дефис");
  }
  res.status(201).json(
    await festivalService.createRace({
      title: str(body.title, "title", 120),
      slug,
      laps: intInRange(body.laps, "laps", 1, 9),
      stations: intInRange(body.stations, "stations", 1, 12),
      penalty_seconds:
        body.penalty_seconds === undefined
          ? 15
          : intInRange(body.penalty_seconds, "penalty_seconds", 0, 600),
      heat_size:
        body.heat_size === undefined
          ? 6
          : intInRange(body.heat_size, "heat_size", 1, 99),
    }),
  );
}

export async function deleteRace(req: Request, res: Response): Promise<void> {
  await festivalService.deleteRace(raceId(req));
  res.status(204).end();
}

export async function setStations(req: Request, res: Response): Promise<void> {
  const names = (req.body as Record<string, unknown>).names;
  if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
    throw new AppError(400, "Поле 'names' должно быть списком строк");
  }
  res.json(await festivalService.setStations(raceId(req), names as string[]));
}

export async function setRoster(req: Request, res: Response): Promise<void> {
  const raw = (req.body as Record<string, unknown>).rows;
  if (!Array.isArray(raw)) {
    throw new AppError(400, "Поле 'rows' должно быть списком участников");
  }
  const rows: FestivalRosterRow[] = raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      number: intInRange(row.number, "number", 1, 999),
      name: str(row.name, "name", 120),
      team: optionalStr(row.team, 60),
      judge_name: optionalStr(row.judge_name, 120),
      heat:
        row.heat === undefined || row.heat === null
          ? null
          : intInRange(row.heat, "heat", 1, 99),
    };
  });
  res.json(await festivalService.setRoster(raceId(req), rows));
}

export async function startRace(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.startRace(raceId(req)));
}

export async function finishRace(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.finishRace(raceId(req)));
}

export async function resetRace(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.resetRace(raceId(req)));
}

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.deleteEventAsAdmin(rowId(req)));
}

export async function deletePoint(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.deletePointAsAdmin(rowId(req)));
}

export async function deletePenalty(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.deletePenaltyAsAdmin(rowId(req)));
}

// Настройки гонки правятся на странице: название, дистанция, цена штрафа,
// размер стартовой группы.
export async function updateRace(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  res.json(
    await festivalService.updateRace(raceId(req), {
      title: str(body.title, "title", 120),
      laps: intInRange(body.laps, "laps", 1, 9),
      stations: intInRange(body.stations, "stations", 1, 12),
      penalty_seconds: intInRange(body.penalty_seconds, "penalty_seconds", 0, 600),
      heat_size: intInRange(body.heat_size, "heat_size", 1, 99),
    }),
  );
}

// Правка результатов участника админом — за судью, который ошибся или отстал.
export async function adminMark(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.adminMarkNext(rowId(req)));
}

export async function adminUndoEvent(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.adminUndoLastEvent(rowId(req)));
}

export async function adminAddPenalty(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.adminAddPenalty(rowId(req)));
}

export async function adminUndoPenalty(req: Request, res: Response): Promise<void> {
  res.json(await festivalService.adminUndoLastPenalty(rowId(req)));
}

export async function adminAddPoints(req: Request, res: Response): Promise<void> {
  const points = intInRange(
    (req.body as Record<string, unknown>).points,
    "points",
    -1000,
    1000,
  );
  if (points === 0) throw new AppError(400, "Ноль баллов записывать нечего");
  res.json(await festivalService.adminAddPoints(rowId(req), points));
}
