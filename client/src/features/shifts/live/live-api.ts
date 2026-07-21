import { api } from "../../../shared/api/client";
import type {
  AwardKind,
  Contest,
  CupInput,
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
};
