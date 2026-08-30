import { api, createApi } from "../../shared/api/client";
import type {
  FestivalAdminBoard,
  FestivalBallot,
  FestivalBoard,
  FestivalJudgeView,
  FestivalNext,
  FestivalRace,
  FestivalRaceSettings,
  FestivalRosterRow,
  FestivalVoteTally,
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

  // Голосование зала: бюллетень и голос открыты всем, зритель приходит по QR.
  // Ключ устройства — единственное, что отличает один телефон от другого.
  ballot: (slug: string) => publicClient.get<FestivalBallot>(`/festival/vote/${slug}`),
  vote: (slug: string, participantId: number, device: string) =>
    publicClient.post<{ accepted: true }>(`/festival/vote/${slug}`, {
      participant_id: participantId,
      device,
    }),

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
    // Цвет своего номера на экране показа; null — вернуться к цвету команды.
    setColor: (color: string | null) =>
      judgeClient.put<FestivalJudgeView>("/festival/judge/color", { color }),
    votes: () => judgeClient.get<FestivalVoteTally>("/festival/judge/votes"),
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
    updateSettings: (raceId: number, input: FestivalRaceSettings) =>
      api.put<FestivalAdminBoard>(`/festival/races/${raceId}/settings`, input),
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

    // Правка результата участника: админ действует как его судья.
    mark: (participantId: number) =>
      api.post<FestivalAdminBoard>(`/festival/participants/${participantId}/mark`),
    undoEvent: (participantId: number) =>
      api.delete<FestivalAdminBoard>(
        `/festival/participants/${participantId}/events/last`,
      ),
    addPenalty: (participantId: number) =>
      api.post<FestivalAdminBoard>(
        `/festival/participants/${participantId}/penalties`,
      ),
    undoPenalty: (participantId: number) =>
      api.delete<FestivalAdminBoard>(
        `/festival/participants/${participantId}/penalties/last`,
      ),
    setFinalists: (raceId: number, participantIds: number[]) =>
      api.put<FestivalAdminBoard>(`/festival/races/${raceId}/finalists`, {
        participant_ids: participantIds,
      }),
    publishResults: (raceId: number, published: boolean) =>
      api.put<FestivalAdminBoard>(`/festival/races/${raceId}/results`, {
        published,
      }),
    setVoting: (raceId: number, open: boolean) =>
      api.put<FestivalAdminBoard>(`/festival/races/${raceId}/voting`, { open }),
    clearVotes: (raceId: number) =>
      api.delete<FestivalAdminBoard>(`/festival/races/${raceId}/votes`),
    // Правка времени: чистые секунды или null — вернуться к посчитанному.
    setTime: (participantId: number, seconds: number | null) =>
      api.put<FestivalAdminBoard>(
        `/festival/participants/${participantId}/time`,
        { seconds },
      ),
    setColor: (participantId: number, color: string | null) =>
      api.put<FestivalAdminBoard>(
        `/festival/participants/${participantId}/color`,
        { color },
      ),
    addPoints: (participantId: number, points: number) =>
      api.post<FestivalAdminBoard>(
        `/festival/participants/${participantId}/points`,
        { points },
      ),
  },
};
