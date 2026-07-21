import { api } from "../../shared/api/client";
import type {
  BoardEntry,
  ChildBreakdown,
  LiveShiftProgress,
  LookupRow,
  MyBreakdown,
  OverviewEntry,
  RankingEntry,
  SparkAdjustment,
  SparksSummary,
} from "./types";

type RatingMode = "overall" | "current";
const modeQuery = (m: RatingMode) => (m === "current" ? "?mode=current" : "");

export const sparksApi = {
  me: () => api.get<SparksSummary>("/sparks/me"),
  myBreakdown: () => api.get<MyBreakdown>("/sparks/me/breakdown"),
  // Ребёнок открыл карточку дня — сервер помечает её просмотренной и отдаёт
  // обновлённый прогресс смены.
  openLiveDay: (shift_id: number, day_number: number) =>
    api.post<LiveShiftProgress | null>("/sparks/me/live/open", {
      shift_id,
      day_number,
    }),
  board: (mode: RatingMode = "overall") =>
    api.get<BoardEntry[]>(`/sparks/board${modeQuery(mode)}`),
  childBreakdown: (id: string) =>
    api.get<ChildBreakdown>(`/sparks/child/${id}/breakdown`),
  adjustments: (id: string) =>
    api.get<SparkAdjustment[]>(`/sparks/child/${id}/adjustments`),
  addAdjustment: (id: string, amount: number, reason: string | null) =>
    api.post<SparkAdjustment>(`/sparks/child/${id}/adjustments`, {
      amount,
      reason,
    }),
  deleteAdjustment: (adjId: number) =>
    api.delete<void>(`/sparks/adjustments/${adjId}`),
  ranking: (mode: RatingMode = "overall") =>
    api.get<RankingEntry[]>(`/sparks/ranking${modeQuery(mode)}`),
  overview: (mode: RatingMode = "overall") =>
    api.get<OverviewEntry[]>(`/sparks/overview${modeQuery(mode)}`),
  lookup: (names: string[]) =>
    api.post<LookupRow[]>("/sparks/lookup", { names }),
};
