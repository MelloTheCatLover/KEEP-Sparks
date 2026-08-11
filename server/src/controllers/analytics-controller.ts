import { Request, Response } from "express";
import * as analyticsService from "../services/analytics-service";

// Единый отчёт по наградам: разрез каталога, смены, новички против опытных и
// лестница рейтинга. Один запрос — страница показывает всё сразу.
export async function rewards(_req: Request, res: Response): Promise<void> {
  res.json(await analyticsService.getRewardAnalytics());
}
