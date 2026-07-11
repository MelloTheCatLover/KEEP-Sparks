import { GeneratedCredential } from "./children";

export interface ShiftSummary {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  child_count: number;
  // Whether the shift feeds the global ranking (false e.g. for shift 120).
  in_rating: boolean;
  // When set, overrides the roster size for difficulty (the pre-83 archive
  // shift is scored as for 40 kids).
  person_count_override: number | null;
  // Person of the shift (Человек смены), null if not recorded.
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

// One roster member with their achievement amounts on a shift. `counts` is
// keyed by settings.name (e.g. "reality_winner"), matching the client columns.
export interface ShiftMemberRow {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  counts: Record<string, number>;
}

// Editable grid for one shift: the achievement catalogue plus each member's
// current amounts.
export interface ShiftAchievementsGrid {
  settings: { id: number; name: string; value: number }[];
  members: ShiftMemberRow[];
}

// One cell edit: set a member's amount for a catalogue action on the shift.
export interface AchievementEdit {
  user_id: string;
  setting_id: number;
  amount: number;
}

// Outcome of rostering a pasted "Фамилия Имя [Отчество]" list onto a shift.
// Existing children are matched and reused; missing ones are created with
// generated credentials (plaintext returned once so the admin can hand them
// out). `grid` is the refreshed editable grid, ready for entering achievements.
export interface AddMembersResult {
  grid: ShiftAchievementsGrid;
  rostered: number; // roster rows newly inserted
  created: number; // new child accounts created
  reused: number; // matched existing children
  skipped: string[]; // input lines that could not be parsed
  credentials: GeneratedCredential[]; // logins/passwords of created accounts
}

// One day's person(s) of the day: a global day number, the shift it fell on,
// and the child(ren) named that day. Flat, ordered by day number.
export interface PersonOfDayEntry {
  day_number: number;
  date: string;
  shift_id: number;
  people: WinnerPerson[];
}

// A person named on the winners board (reality-show winner or finalist).
export interface WinnerPerson {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

// Reality-show winner and finalists for one shift, derived from achievements.
// The winner is also present in `finalists` (they reached the final), mirroring
// the source spreadsheet's layout.
export interface ShiftWinners {
  shift_id: number;
  winner: WinnerPerson | null;
  finalists: WinnerPerson[];
}

// Partial shift meta update. Only the present fields are written.
export interface ShiftMetaInput {
  name?: string | null;
  start_date?: string;
  end_date?: string;
  in_rating?: boolean;
  person_of_the_shift?: string | null;
}
