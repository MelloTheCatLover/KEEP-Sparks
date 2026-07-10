import { api } from "../../shared/api/client";
import type {
  AchievementEdit,
  AddMembersResult,
  ShiftAchievementsGrid,
  ShiftDetail,
  ShiftMetaInput,
  ShiftSummary,
} from "./types";

export const shiftsApi = {
  list: () => api.get<ShiftSummary[]>("/shifts"),
  detail: (id: number) => api.get<ShiftDetail>(`/shifts/${id}`),
  achievements: (id: number) =>
    api.get<ShiftAchievementsGrid>(`/shifts/${id}/achievements`),
  saveAchievements: (id: number, edits: AchievementEdit[]) =>
    api.put<ShiftAchievementsGrid>(`/shifts/${id}/achievements`, { edits }),
  addMembers: (id: number, names: string[]) =>
    api.post<AddMembersResult>(`/shifts/${id}/members`, { names }),
  updateMeta: (id: number, fields: ShiftMetaInput) =>
    api.patch<ShiftSummary>(`/shifts/${id}`, fields),
};
