import { api } from "../../shared/api/client";
import type { ShiftSummary } from "./types";

export const shiftsApi = {
  list: () => api.get<ShiftSummary[]>("/shifts"),
};
