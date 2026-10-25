import { api } from "../../shared/api/client";
import type {
  MyTrials,
  TrialBoard,
  TrialScoreRow,
  TrialUploadResult,
} from "./types";

export const trialsApi = {
  board: (shiftId: number) => api.get<TrialBoard>(`/shifts/${shiftId}/trials`),
  create: (shiftId: number, day: number, title: string) =>
    api.post<TrialBoard>(`/shifts/${shiftId}/trials`, { day, title }),
  update: (
    shiftId: number,
    trialId: number,
    fields: { day?: number; title?: string; published?: boolean },
  ) => api.patch<TrialBoard>(`/shifts/${shiftId}/trials/${trialId}`, fields),
  remove: (shiftId: number, trialId: number) =>
    api.delete<TrialBoard>(`/shifts/${shiftId}/trials/${trialId}`),
  // apply = false — только показать, как сервер понял строки.
  upload: (
    shiftId: number,
    trialId: number,
    rows: TrialScoreRow[],
    apply: boolean,
  ) =>
    api.post<TrialUploadResult>(
      `/shifts/${shiftId}/trials/${trialId}/scores`,
      { rows, apply },
    ),
  mine: () => api.get<MyTrials | null>("/sparks/me/trials"),
};
