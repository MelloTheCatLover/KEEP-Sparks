import { api } from "../../shared/api/client";
import type { RankTrajectories, RewardAnalytics } from "./types";

export const analyticsApi = {
  rewards: () => api.get<RewardAnalytics>("/analytics/rewards"),
  trajectories: () => api.get<RankTrajectories>("/analytics/trajectories"),
};
