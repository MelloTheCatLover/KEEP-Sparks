// Mirror of server types/shifts.ts.
export interface ShiftSummary {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  child_count: number;
  in_rating: boolean;
  roster_locked: boolean;
  person_count_override: number | null;
  person_user_id: string | null;
  person_f_name: string | null;
  person_m_name: string | null;
  person_l_name: string | null;
}

export type KtpStatus = "mvp" | "winner" | "participant" | "new";
export type KtbStatus = "team_best" | "winner" | "participant" | "new";

export interface ShiftRankEntry {
  rank: number;
  sparks: number;
  number: number | null;
  sparks_before: number;
  age: number | null;
  is_new: boolean;
  ktp_status: KtpStatus;
  ktb_status: KtbStatus;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
}

export interface ShiftDetail extends ShiftSummary {
  difficulty: number;
  average_age: number | null;
  ranking: ShiftRankEntry[];
}

// counts keyed by settings.name (e.g. "reality_winner").
export interface ShiftMemberRow {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  counts: Record<string, number>;
}

export interface ShiftAchievementsGrid {
  settings: { id: number; name: string; value: number }[];
  members: ShiftMemberRow[];
}

export interface AchievementEdit {
  user_id: string;
  setting_id: number;
  amount: number;
}

// Plaintext credentials of a newly created child, shown once so the admin can
// hand them out.
export interface GeneratedCredential {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  password: string;
}

export interface AddMembersResult {
  grid: ShiftAchievementsGrid;
  rostered: number;
  created: number;
  reused: number;
  skipped: string[];
  credentials: GeneratedCredential[];
}

export interface WinnerPerson {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

export interface RosterRow {
  name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  height?: number | null;
  allergy?: string | null;
  parent?: string | null;
  phone?: string | null;
}

export interface CreateShiftInput {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  roster: RosterRow[];
}

export interface GeneratedNumber {
  number: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  sparks: number;
  is_prev_winner: boolean;
  is_new: boolean;
  age: number | null;
}

export interface CreateShiftResult {
  shift_id: number;
  previous_shift_id: number | null;
  winner: WinnerPerson | null;
  winner_in_list: boolean;
  numbers: GeneratedNumber[];
  created: number;
  reused: number;
  skipped: string[];
  credentials: GeneratedCredential[];
  average_age: number | null;
}

// Перевыдача номеров существующей смене: то же правило, но по нынешнему
// ростеру и нынешним искрам.
export interface RecomputeNumbersResult {
  shift_id: number;
  winner_shift_id: number | null;
  winner: WinnerPerson | null;
  winner_in_list: boolean;
  numbers: GeneratedNumber[];
}

export interface PersonOfDayEntry {
  day_number: number;
  date: string;
  shift_id: number;
  people: WinnerPerson[];
}

// Reality-show winner + finalists for one shift (winner is also in finalists).
export interface ShiftWinners {
  shift_id: number;
  winner: WinnerPerson | null;
  finalists: WinnerPerson[];
}

export interface ShiftMetaInput {
  name?: string | null;
  start_date?: string;
  end_date?: string;
  in_rating?: boolean;
  roster_locked?: boolean;
  person_of_the_shift?: string | null;
}

// Diff of a pasted ФИО list against a shift roster (mirror of server types).
export interface RosterSyncMember {
  user_id: string | null; // null = would be created as a new account
  f_name: string;
  m_name: string | null;
  l_name: string;
}

export interface RosterSyncRemoval {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

export interface RosterSyncPreview {
  add: RosterSyncMember[];
  remove: RosterSyncRemoval[];
  keep: number;
  new_accounts: number;
  skipped: string[];
}

export interface RosterSyncResult {
  applied: boolean;
  preview: RosterSyncPreview;
  grid: ShiftAchievementsGrid | null;
  credentials: GeneratedCredential[];
}

// One child's all-time КТП/КТБ record on the contests board.
export interface ContestPerson {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  ktp_status: KtpStatus;
  ktb_status: KtbStatus;
  ktp_shifts: number[];
  ktb_shifts: number[];
  counts: Record<string, number>;
}

export interface ContestsBoard {
  ktp_shift_ids: number[];
  ktb_shift_ids: number[];
  people: ContestPerson[];
}
