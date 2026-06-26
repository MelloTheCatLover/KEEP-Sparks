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
}
