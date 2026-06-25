import { api } from "../../shared/api/client";
import type { ShiftDetail, ShiftSummary } from "./types";

export const shiftsApi = {
  list: () => api.get<ShiftSummary[]>("/shifts"),
  detail: (id: number) => api.get<ShiftDetail>(`/shifts/${id}`),
};
