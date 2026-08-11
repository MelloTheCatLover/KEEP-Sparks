// Зеркало server/src/types/analytics.ts.

export type AwardCategory =
  | "team_shared"
  | "team_personal"
  | "reality"
  | "stars"
  | "personal"
  | "base";

export interface CategoryStat {
  category: AwardCategory;
  xp: number;
  pct: number;
  units: number;
  kids: number;
}

export interface AwardStat {
  key: string;
  value: number;
  category: AwardCategory;
  units: number;
  xp: number;
  pct: number;
  kids: number;
  shifts_present: number;
  avg_pct_roster: number;
  avg_xp_per_recipient: number;
}

export interface ShiftStat {
  shift_id: number;
  name: string | null;
  start_date: string;
  roster: number;
  difficulty: number;
  rookies: number;
  rookie_pct_roster: number;
  rookie_pct_xp: number;
  median_rookie: number;
  median_veteran: number;
  median: number;
  max_xp: number;
  team_pct_xp: number;
  base_pct_xp: number;
  gini: number;
}

export interface CohortStat {
  cohort: "rookie" | "veteran";
  child_shifts: number;
  median_xp: number;
  p90_xp: number;
  median_earned: number;
  pct_zero_earned: number;
  avg_percentile: number;
  pct_top3: number;
  pct_top10: number;
  pct_top25: number;
  avg_team_xp: number;
  pct_any_team: number;
}

export interface RankBand {
  band: string;
  kids: number;
  avg_sparks: number;
  median_gap: number;
}

export interface LadderStep {
  shifts: number;
  kids: number;
  median_sparks: number;
  pct_in_top25: number;
}

export interface Distribution {
  children: number;
  median: number;
  p75: number;
  p90: number;
  p99: number;
  max: number;
  top10_share: number;
  gini: number;
  bands: RankBand[];
  ladder: LadderStep[];
}

export interface RewardAnalytics {
  shifts_counted: number;
  child_shifts: number;
  total_xp: number;
  categories: CategoryStat[];
  awards: AwardStat[];
  shifts: ShiftStat[];
  cohorts: CohortStat[];
  distribution: Distribution;
}
