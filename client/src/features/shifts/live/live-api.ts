import { api } from "../../../shared/api/client";
import type {
  AwardKind,
  Contest,
  CupInput,
  DayAwardRow,
  KtbDraftPlan,
  LiveBoard,
  StageInput,
  TeamInput,
} from "./live-types";

// Каждая мутация возвращает пересчитанную доску целиком — клиент не собирает
// состояние сам, а заменяет его ответом.
export const liveApi = {
  board: (shiftId: number) => api.get<LiveBoard>(`/shifts/${shiftId}/live`),
  setMode: (shiftId: number, live_mode: boolean) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/mode`, { live_mode }),
  saveAward: (
    shiftId: number,
    kind: AwardKind,
    day_number: number,
    user_ids: string[],
  ) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/awards`, {
      kind,
      day_number,
      user_ids,
    }),
  saveTeams: (shiftId: number, contest: Contest, teams: TeamInput[]) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/teams`, { contest, teams }),
  saveStages: (shiftId: number, stages: StageInput[]) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/stages`, { stages }),
  saveCups: (shiftId: number, cups: CupInput[]) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/cups`, { cups }),
  setWinner: (shiftId: number, contest: Contest, team_id: number | null) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/winner`, { contest, team_id }),
  setDayReady: (shiftId: number, day_number: number, ready: boolean) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/day`, { day_number, ready }),
  // Кто и что получит за день — смотрят перед тем, как отдать искры.
  dayAwards: (shiftId: number, day: number) =>
    api.get<DayAwardRow[]>(`/shifts/${shiftId}/live/days/${day}`),
  // Черновик раздачи КТБ: считает раскладку, но ничего не пишет — сохраняет её
  // обычный saveTeams полученными member_ids.
  ktbPlan: (shiftId: number, team_names: string[]) =>
    api.post<KtbDraftPlan>(`/shifts/${shiftId}/live/ktb/plan`, { team_names }),
  // `reveal_at` — «настенное» время лагеря (`2026-07-31T21:00`) или null.
  setKtbReveal: (shiftId: number, reveal_at: string | null) =>
    api.put<LiveBoard>(`/shifts/${shiftId}/live/ktb/reveal`, { reveal_at }),
};
