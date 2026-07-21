// Child's spark summary: total coefficient-adjusted XP and global rank.
export interface SparksSummary {
  sparks: number;
  rank: number;
  total: number;
}

// One row of the admin ranking table.
export interface RankingEntry {
  rank: number;
  sparks: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
}

// One row of the full overview ("Общий рейтинг"): the ranking entry plus a
// per-setting breakdown of achievement counts (catalogue key -> total amount).
export interface OverviewEntry extends RankingEntry {
  counts: Record<string, number>;
  in_current_rating: boolean;
  is_adult: boolean;
}

// One result of a names lookup: the raw input line and the matched child's
// overview entry (null when no child matched).
export interface LookupRow {
  input: string;
  entry: OverviewEntry | null;
}

// One shift in a child's personal breakdown: their score and placement on that
// shift, a running cumulative total, and the per-achievement counts.
export interface MyShiftStat {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  sparks: number; // coefficient-adjusted score on this shift
  rank: number; // placement among the shift's roster
  shift_total: number; // roster size
  cumulative: number; // running sum of sparks up to and including this shift
  counts: Record<string, number>;
}

// A manual spark adjustment. amount is signed: > 0 bonus (visible to the
// child), < 0 penalty (hidden). reason is admin-only.
export interface SparkAdjustment {
  id: number;
  user_id: string;
  amount: number;
  reason: string | null;
  created_at: string;
}

// One revealed day of the shift a child is on right now. `delta` is the growth
// of their coefficient-adjusted total on that day: the difference of two
// rounded running totals, so the deltas always add up to `sparks` exactly.
export interface LiveDay {
  day_number: number;
  date: string;
  delta: number;
  opened: boolean; // the child has already opened this day's card
  items: LiveDayItem[]; // what the sparks came for
}

// One line of a day's card: catalogue key and how many times it was earned.
// Deliberately without per-item sparks — the coefficient is applied once to the
// day's total, so per-item values would not add up to `delta`.
export interface LiveDayItem {
  key: string;
  amount: number;
}

// Progress of the shift being run right now, as the child may see it: only days
// already revealed (12:00 the next day), plus when the next one opens.
export interface LiveShiftProgress {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  day_count: number;
  sparks: number; // coefficient-adjusted total of the revealed days
  days: LiveDay[];
  pending: LiveDay | null; // newest revealed day the child has not opened yet
  next_reveal_at: string | null; // null once the last day is revealed
}

// A child's personal dashboard payload: overall summary, total achievement
// counts, and the per-shift history (oldest first, for the chart).
export interface MyBreakdown {
  summary: SparksSummary; // placement in the overall ranking
  current: SparksSummary | null; // placement in the current ranking (null when excluded: 18+ or opted out)
  totals: Record<string, number>;
  shifts: MyShiftStat[];
  bonuses: SparkAdjustment[]; // positive adjustments only; penalties stay hidden
  live: LiveShiftProgress | null; // the shift being run right now, if any
}

// One row of the public sparks board children see: name + score, no login.
export interface BoardEntry {
  rank: number;
  sparks: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

// Same payload viewed by an admin, with the child's name attached.
export interface ChildBreakdown extends MyBreakdown {
  f_name: string;
  m_name: string | null;
  l_name: string;
}
