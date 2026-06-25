import { api } from "../../shared/api/client";
import type { SparksSummary } from "./types";

export const sparksApi = {
  me: () => api.get<SparksSummary>("/sparks/me"),
};
