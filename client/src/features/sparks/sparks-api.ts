import type { SparksSummary } from "./types";

// MOCK. Replace this body with `api.get<SparksSummary>("/sparks/me")` when the
// server calculator lands. Shape is the real contract, so callers won't change.
export const sparksApi = {
  me: (): Promise<SparksSummary> =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ sparks: 4200, rank: 7, total: 128 }), 300),
    ),
};
