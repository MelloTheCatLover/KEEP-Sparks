import { api } from "../../shared/api/client";
import type {
  AchievementEdit,
  AddMembersResult,
  ContestsBoard,
  GeneratedCredential,
  CreateShiftInput,
  CreateShiftResult,
  ShiftAchievementsGrid,
  ShiftDetail,
  PersonOfDayEntry,
  RosterSyncResult,
  ShiftMetaInput,
  ShiftSummary,
  ShiftWinners,
} from "./types";
import type { EventBoard } from "./event-types";

export const shiftsApi = {
  list: () => api.get<ShiftSummary[]>("/shifts"),
  create: (input: CreateShiftInput) =>
    api.post<CreateShiftResult>("/shifts", input),
  winners: () => api.get<ShiftWinners[]>("/shifts/winners"),
  contests: () => api.get<ContestsBoard>("/shifts/contests"),
  peopleOfDay: () => api.get<PersonOfDayEntry[]>("/shifts/people-of-day"),
  detail: (id: number) => api.get<ShiftDetail>(`/shifts/${id}`),
  achievements: (id: number) =>
    api.get<ShiftAchievementsGrid>(`/shifts/${id}/achievements`),
  saveAchievements: (id: number, edits: AchievementEdit[]) =>
    api.put<ShiftAchievementsGrid>(`/shifts/${id}/achievements`, { edits }),
  addMembers: (id: number, names: string[]) =>
    api.post<AddMembersResult>(`/shifts/${id}/members`, { names }),
  syncRoster: (id: number, names: string[], apply: boolean) =>
    api.post<RosterSyncResult>(`/shifts/${id}/roster/sync`, { names, apply }),
  rosterCredentials: (id: number) =>
    api.post<GeneratedCredential[]>(`/shifts/${id}/roster/credentials`, {}),
  updateMeta: (id: number, fields: ShiftMetaInput) =>
    api.patch<ShiftSummary>(`/shifts/${id}`, fields),

  // Смена-событие: день рождения лагеря. Каждый ответ — доска целиком, как в
  // «Ведении»: одна правка, одно состояние, никакой сборки на клиенте.
  event: (id: number) => api.get<EventBoard>(`/shifts/${id}/event`),
  setEventMode: (id: number, event_mode: boolean) =>
    api.put<EventBoard>(`/shifts/${id}/event/mode`, { event_mode }),
  addEventAwards: (
    id: number,
    user_ids: string[],
    title: string,
    amount: number,
    published: boolean,
    in_rating: boolean,
  ) =>
    api.post<EventBoard>(`/shifts/${id}/event/awards`, {
      user_ids,
      title,
      amount,
      published,
      in_rating,
    }),
  setEventAwardPublished: (id: number, awardId: number, published: boolean) =>
    api.patch<EventBoard>(`/shifts/${id}/event/awards/${awardId}`, {
      published,
    }),
  publishEventAwards: (id: number) =>
    api.post<EventBoard>(`/shifts/${id}/event/publish`, {}),
  deleteEventAward: (id: number, awardId: number) =>
    api.delete<EventBoard>(`/shifts/${id}/event/awards/${awardId}`),
  copyEventRoster: (id: number, from_shift_id: number) =>
    api.post<EventBoard>(`/shifts/${id}/event/roster/copy`, { from_shift_id }),
  // Розыгрыш: числа раздаёт сервер. Ребёнок узнаёт своё, только открыв сундук.
  drawPrizes: (id: number, min: number, max: number) =>
    api.post<EventBoard>(`/shifts/${id}/event/draw`, { min, max }),
  redrawPrizes: (id: number, min: number, max: number) =>
    api.post<EventBoard>(`/shifts/${id}/event/draw/redraw`, { min, max }),
  clearPrizes: (id: number) =>
    api.delete<EventBoard>(`/shifts/${id}/event/draw`),
};
