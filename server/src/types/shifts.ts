export interface ShiftSummary {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  child_count: number;
  // Whether the shift feeds the global ranking (false e.g. for shift 120).
  in_rating: boolean;
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
