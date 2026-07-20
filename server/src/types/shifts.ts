import { GeneratedCredential } from "./children";
import { KtbStatus, KtpStatus } from "./contests";

export interface ShiftSummary {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  child_count: number;
  // Whether the shift feeds the global ranking (false e.g. for shift 120).
  in_rating: boolean;
  // Manual "shift closed" flag. While false the roster may be re-synced from a
  // pasted ФИО list; once true, roster sync is refused.
  roster_locked: boolean;
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
  sparks: number; // this shift's coefficient-adjusted score (0 until loaded)
  number: number | null; // assigned starting number
  sparks_before: number; // overall sparks before this shift
  age: number | null;
  is_new: boolean; // this shift is the child's first
  // Contest standing as the child arrived at this shift (from history before it).
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

// One roster row. `name` is the only required field; the rest come from an
// imported shift info table (Пол / Дата рождения / Рост / Аллергия / Родитель /
// Телефон) and, when present, backfill the child's profile.
export interface RosterRow {
  name: string;
  gender?: string | null; // "Ж" / "М" / "female" / "male"
  date_of_birth?: string | null; // "дд.мм.гггг" or ISO
  height?: number | null;
  allergy?: string | null; // freeform, split into items
  parent?: string | null; // "Фамилия Имя Отчество"
  phone?: string | null; // one or two concatenated numbers
}

// Create a shift from the "Генерация номеров" flow: the meta plus a roster. The
// shift starts out of the ranking (in_rating = false) until its results are
// loaded later.
export interface CreateShiftInput {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  roster: RosterRow[];
}

// One assigned number in the generated roster.
export interface GeneratedNumber {
  number: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  sparks: number;
  is_prev_winner: boolean;
  is_new: boolean; // account created by this import
  age: number | null;
}

// Result of creating a shift and generating its numbers. Number 1 is reserved
// for the previous shift's reality-show winner; when they are not on the list,
// numbering starts at 2 and no one holds 1.
export interface CreateShiftResult {
  shift_id: number;
  previous_shift_id: number | null;
  winner: WinnerPerson | null; // reality winner of the previous shift
  winner_in_list: boolean;
  numbers: GeneratedNumber[];
  created: number;
  reused: number;
  skipped: string[];
  credentials: GeneratedCredential[];
  average_age: number | null; // mean age of roster kids with a birth date
}

// Partial shift meta update. Only the present fields are written.
export interface ShiftMetaInput {
  name?: string | null;
  start_date?: string;
  end_date?: string;
  in_rating?: boolean;
  roster_locked?: boolean;
  person_of_the_shift?: string | null;
}

// One resolved line of a pasted ФИО list against the shift roster. `user_id` is
// null when the name matches no existing child (a new account would be created).
export interface RosterSyncMember {
  user_id: string | null;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

// A current roster member the pasted list does not mention — dropped on apply.
export interface RosterSyncRemoval {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

// Dry-run diff of a pasted ФИО list against a shift's current roster: who would
// be added (existing children reused or brand-new accounts), who removed, and
// how many already match. Also returned alongside the outcome after apply.
export interface RosterSyncPreview {
  add: RosterSyncMember[]; // in list, not on the shift yet
  remove: RosterSyncRemoval[]; // on the shift, absent from the list
  keep: number; // already on the shift and in the list
  new_accounts: number; // `add` entries with no existing match
  skipped: string[]; // input lines that could not be parsed
}

// Result of POST /shifts/:id/roster/sync. On a dry run `applied` is false and
// only `preview` is set; on apply the roster is changed and the refreshed grid
// plus any created accounts' credentials come back.
export interface RosterSyncResult {
  applied: boolean;
  preview: RosterSyncPreview;
  grid: ShiftAchievementsGrid | null;
  credentials: GeneratedCredential[];
}
