// Mirror of server types/sparks.ts.
export interface SparksSummary {
  sparks: number;
  rank: number;
  total: number;
}

export interface RankingEntry {
  rank: number;
  sparks: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
}

// Full overview row: ranking entry plus per-setting counts (key -> amount).
export interface OverviewEntry extends RankingEntry {
  counts: Record<string, number>;
  in_current_rating: boolean;
  is_adult: boolean;
}

// Result of a names lookup: raw input line + matched entry (null if no match).
export interface LookupRow {
  input: string;
  entry: OverviewEntry | null;
}

export interface MyShiftStat {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  sparks: number;
  rank: number;
  shift_total: number;
  cumulative: number;
  counts: Record<string, number>;
}

export interface MyBreakdown {
  summary: SparksSummary;
  totals: Record<string, number>;
  shifts: MyShiftStat[];
}

export interface ChildBreakdown extends MyBreakdown {
  f_name: string;
  m_name: string | null;
  l_name: string;
}
