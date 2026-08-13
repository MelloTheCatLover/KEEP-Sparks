import { Request, Response } from "express";
import * as settingsService from "../services/settings-service";
import { AppError } from "../middleware/error";

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await settingsService.list());
}

// Праздничное оформление: спрашивают все, в том числе с экрана входа.
export async function festive(_req: Request, res: Response): Promise<void> {
  res.json(await settingsService.getFestive());
}

// Легенда «за что искры»: каталог с ценами той смены, которая касается ребёнка.
export async function legend(_req: Request, res: Response): Promise<void> {
  res.json(await settingsService.getLegend());
}

// Окно правки цен: до какой даты прошлое заморожено и с какой смены имеет
// смысл объявлять новый прайс.
export async function priceWindow(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json(await settingsService.getPriceWindow());
}

function settingId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new AppError(400, "Invalid setting id");
  }
  return id;
}

// Дата версии — обычный ISO-день. Время тут не при чём: цена привязана к дате
// начала смены.
function isoDate(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError(400, "Field 'valid_from' must be a YYYY-MM-DD date");
  }
  return raw;
}

// Объявить цену достижения с даты. Правки «прямо сейчас» больше нет: у цены
// всегда есть дата начала, иначе изменение переписало бы уже выданные искры.
export async function setPrice(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const value = body.value;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AppError(400, "Field 'value' must be a non-negative integer");
  }
  res.json(
    await settingsService.setPrice(settingId(req), isoDate(body.valid_from), value),
  );
}

export async function deletePrice(req: Request, res: Response): Promise<void> {
  res.json(
    await settingsService.deletePrice(
      settingId(req),
      isoDate(req.params.validFrom),
    ),
  );
}
