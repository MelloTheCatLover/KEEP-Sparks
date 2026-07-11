// Mirror of server types/shifts.ts.
export interface ShiftSummary {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  child_count: number;
  in_rating: boolean;
  person_count_override: number | null;
  person_user_id: string | null;
  person_f_name: string | null;
  person_m_name: string | null;
  person_l_name: string | null;
}

export interface ShiftRankEntry {
  rank: number;
  sparks: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
}

export interface ShiftDetail extends ShiftSummary {
  difficulty: number;
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

export interface CreateShiftInput {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  names: string[];
}

export interface GeneratedNumber {
  number: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  sparks: number;
  is_prev_winner: boolean;
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
  person_of_the_shift?: string | null;
}
