import { api } from "../../shared/api/client";
import type {
  ChildBreakdown,
  LookupRow,
  MyBreakdown,
  OverviewEntry,
  RankingEntry,
  SparksSummary,
} from "./types";

type RatingMode = "overall" | "current";
const modeQuery = (m: RatingMode) => (m === "current" ? "?mode=current" : "");

export const sparksApi = {
  me: () => api.get<SparksSummary>("/sparks/me"),
  myBreakdown: () => api.get<MyBreakdown>("/sparks/me/breakdown"),
  childBreakdown: (id: string) =>
    api.get<ChildBreakdown>(`/sparks/child/${id}/breakdown`),
  ranking: (mode: RatingMode = "overall") =>
    api.get<RankingEntry[]>(`/sparks/ranking${modeQuery(mode)}`),
  overview: (mode: RatingMode = "overall") =>
    api.get<OverviewEntry[]>(`/sparks/overview${modeQuery(mode)}`),
  lookup: (names: string[]) =>
    api.post<LookupRow[]>("/sparks/lookup", { names }),
};
