// Испытания смены — внутренняя игра со своими баллами (134 смена, «Разбитый
// парк»). Зеркало server/src/types/trials.ts.

export interface Trial {
  id: number;
  day: number;
  title: string;
  published: boolean;
  scored: number;
}

export interface TrialMember {
  user_id: string;
  number: number | null;
  f_name: string;
  m_name: string | null;
  l_name: string;
  scores: Record<string, number>; // trial id → баллы
  total: number; // включая неопубликованные
  place: number;
}

export interface TrialBoard {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  days: number;
  trials: Trial[];
  members: TrialMember[];
}

export interface TrialScoreRow {
  number: number | null;
  name: string;
  points: number;
}

export type TrialRowStatus =
  | "ok"
  | "mismatch"
  | "unknown"
  | "ambiguous"
  | "duplicate";

export interface TrialRowMatch {
  line: number;
  number: number | null;
  name: string;
  points: number;
  status: TrialRowStatus;
  user_id: string | null;
  matched_name: string | null;
  matched_number: number | null;
}

export interface TrialUploadResult {
  applied: boolean;
  rows: TrialRowMatch[];
  board: TrialBoard;
}

export interface MyTrial {
  id: number;
  title: string;
  points: number | null;
  place: number | null;
  scored: number;
}

export interface MyTrialDay {
  day: number;
  total: number;
  trials: MyTrial[];
}

export interface MyTrials {
  shift_id: number;
  name: string | null;
  total: number;
  place: number;
  participants: number;
  days: MyTrialDay[];
}
