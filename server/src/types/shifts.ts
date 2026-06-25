export interface ShiftSummary {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  child_count: number;
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
