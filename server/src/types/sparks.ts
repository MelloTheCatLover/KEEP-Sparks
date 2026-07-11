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

// A child's personal dashboard payload: overall summary, total achievement
// counts, and the per-shift history (oldest first, for the chart).
export interface MyBreakdown {
  summary: SparksSummary;
  totals: Record<string, number>;
  shifts: MyShiftStat[];
}

// Same payload viewed by an admin, with the child's name attached.
export interface ChildBreakdown extends MyBreakdown {
  f_name: string;
  m_name: string | null;
  l_name: string;
}
