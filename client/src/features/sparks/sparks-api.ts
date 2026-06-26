import { api } from "../../shared/api/client";
import type { OverviewEntry, RankingEntry, SparksSummary } from "./types";

export const sparksApi = {
  me: () => api.get<SparksSummary>("/sparks/me"),
  ranking: () => api.get<RankingEntry[]>("/sparks/ranking"),
  overview: () => api.get<OverviewEntry[]>("/sparks/overview"),
};
