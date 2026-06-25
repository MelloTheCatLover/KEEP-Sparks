import { api } from "../../shared/api/client";
import type { RankingEntry, SparksSummary } from "./types";

export const sparksApi = {
  me: () => api.get<SparksSummary>("/sparks/me"),
  ranking: () => api.get<RankingEntry[]>("/sparks/ranking"),
};
