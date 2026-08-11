import { api } from "../../shared/api/client";
import type { RewardAnalytics } from "./types";

export const analyticsApi = {
  rewards: () => api.get<RewardAnalytics>("/analytics/rewards"),
};
