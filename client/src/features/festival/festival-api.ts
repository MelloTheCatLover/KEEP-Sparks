import { api, createApi } from "../../shared/api/client";
import type {
  FestivalAdminBoard,
  FestivalBoard,
  FestivalJudgeView,
  FestivalNext,
  FestivalRace,
  FestivalRosterRow,
} from "./types";

// Судейский токен хранится отдельно от токена искр: судья — не пользователь
// сайта, и его вход не должен выкидывать админа из искр на том же устройстве.
const JUDGE_TOKEN_KEY = "festival_judge_token";

export function getJudgeToken(): string | null {
  return localStorage.getItem(JUDGE_TOKEN_KEY);
}

export function setJudgeToken(token: string): void {
  localStorage.setItem(JUDGE_TOKEN_KEY, token);
}

export function clearJudgeToken(): void {
  localStorage.removeItem(JUDGE_TOKEN_KEY);
}

const judgeClient = createApi(getJudgeToken);
// Экран показа открыт всем: токен ему не нужен и не отправляется.
const publicClient = createApi(() => null);

export const festivalApi = {
  board: (slug: string) => publicClient.get<FestivalBoard>(`/festival/board/${slug}`),

  judge: {
    login: (pin: string) =>
      publicClient.post<{ token: string; view: FestivalJudgeView }>(
        "/festival/judge/login",
        { pin },
      ),
    me: () => judgeClient.get<FestivalJudgeView>("/festival/judge/me"),
    // Отметка несёт точку, которую судья видел на экране: если состояние
    // успело измениться, сервер откажет вместо тихого дубля.
    mark: (next: FestivalNext) =>
      judgeClient.post<FestivalJudgeView>("/festival/judge/mark", next),
    undo: () => judgeClient.delete<FestivalJudgeView>("/festival/judge/events/last"),
    addPoints: (points: number) =>
      judgeClient.post<FestivalJudgeView>("/festival/judge/points", { points }),
    // Штраф: +race.penalty_seconds к итоговому времени участника.
    addPenalty: () =>
      judgeClient.post<FestivalJudgeView>("/festival/judge/penalties"),
    undoPenalty: () =>
      judgeClient.delete<FestivalJudgeView>("/festival/judge/penalties/last"),
    deletePoint: (id: number) =>
      judgeClient.delete<FestivalJudgeView>(`/festival/judge/points/${id}`),
  },

  // Подготовка гонки — под обычным админским токеном искр.
  admin: {
    races: () => api.get<FestivalRace[]>("/festival/races"),
    board: (raceId: number) => api.get<FestivalAdminBoard>(`/festival/races/${raceId}`),
    create: (input: {
      title: string;
      slug: string;
      laps: number;
      stations: number;
      penalty_seconds: number;
    }) =>
      api.post<FestivalRace>("/festival/races", input),
    remove: (raceId: number) => api.delete<void>(`/festival/races/${raceId}`),
    setStations: (raceId: number, names: string[]) =>
      api.put<FestivalAdminBoard>(`/festival/races/${raceId}/stations`, { names }),
    setRoster: (raceId: number, rows: FestivalRosterRow[]) =>
      api.put<FestivalAdminBoard>(`/festival/races/${raceId}/roster`, { rows }),
    start: (raceId: number) =>
      api.post<FestivalAdminBoard>(`/festival/races/${raceId}/start`),
    finish: (raceId: number) =>
      api.post<FestivalAdminBoard>(`/festival/races/${raceId}/finish`),
    reset: (raceId: number) =>
      api.post<FestivalAdminBoard>(`/festival/races/${raceId}/reset`),
    deleteEvent: (id: number) =>
      api.delete<FestivalAdminBoard>(`/festival/events/${id}`),
    deletePoint: (id: number) =>
      api.delete<FestivalAdminBoard>(`/festival/points/${id}`),
    deletePenalty: (id: number) =>
      api.delete<FestivalAdminBoard>(`/festival/penalties/${id}`),
  },
};
