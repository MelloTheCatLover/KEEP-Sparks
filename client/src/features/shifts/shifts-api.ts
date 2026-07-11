import { api } from "../../shared/api/client";
import type {
  AchievementEdit,
  AddMembersResult,
  CreateShiftInput,
  CreateShiftResult,
  ShiftAchievementsGrid,
  ShiftDetail,
  PersonOfDayEntry,
  ShiftMetaInput,
  ShiftSummary,
  ShiftWinners,
} from "./types";

export const shiftsApi = {
  list: () => api.get<ShiftSummary[]>("/shifts"),
  create: (input: CreateShiftInput) =>
    api.post<CreateShiftResult>("/shifts", input),
  winners: () => api.get<ShiftWinners[]>("/shifts/winners"),
  peopleOfDay: () => api.get<PersonOfDayEntry[]>("/shifts/people-of-day"),
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
