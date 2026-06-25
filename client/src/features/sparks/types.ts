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
