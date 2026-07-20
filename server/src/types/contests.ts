// КТП (КГГ) status of a child, best first. "new" = never took part before.
export type KtpStatus = "mvp" | "winner" | "participant" | "new";

// КТБ status of a child, best first. "team_best" (лучший в команде) outranks a
// plain team win, matching its higher spark value.
export type KtbStatus = "team_best" | "winner" | "participant" | "new";

// One child's contest record. Counts and shift lists are limited to the window
// the record was built for: the board uses the whole history, a shift roster
// uses only what happened before that shift.
export interface ContestPerson {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  ktp_status: KtpStatus;
  ktb_status: KtbStatus;
  ktp_shifts: number[]; // КТП shifts attended
  ktb_shifts: number[]; // КТБ shifts attended
  counts: Record<string, number>; // kgg_* / ktb_* amounts
}

// All-time КТП/КТБ board: every child who ever attended one of the contest
// shifts or holds a contest achievement, plus the shift lists it was built on.
export interface ContestsBoard {
  ktp_shift_ids: number[];
  ktb_shift_ids: number[];
  people: ContestPerson[];
}
