// Зеркало server/src/types/live.ts — состояние страницы «Ведение смены».

export const DAILY_AWARD_KINDS = ["reality_leader", "person_of_day"] as const;

export const FINAL_AWARD_KINDS = [
  "reality_winner",
  "reality_super_finalist",
  "reality_finalist",
  "reality_plot",
  "ktb_team_best",
  "kgg_mvp",
  "person_of_shift",
  "recognition",
] as const;

export type DailyAwardKind = (typeof DAILY_AWARD_KINDS)[number];
export type FinalAwardKind = (typeof FINAL_AWARD_KINDS)[number];
export type AwardKind = DailyAwardKind | FinalAwardKind;

export type Contest = "ktb" | "ktp";

export interface AwardEntry {
  kind: AwardKind;
  day_number: number;
  user_ids: string[];
}

export interface LiveTeam {
  id: number;
  name: string;
  position: number;
  member_ids: string[];
}

export interface LiveStage {
  id: number;
  number: number;
  title: string | null;
  scores: Record<number, number>;
  winner_team_ids: number[];
}

export interface LiveCup {
  id: number;
  team_id: number;
  title: string | null;
}

export interface ContestStanding {
  totals: Record<number, number>;
  leader_team_ids: number[];
  manual_team_id: number | null;
  winner_team_id: number | null;
}

export interface LiveMember {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  number: number | null;
}

export interface LiveBoard {
  shift_id: number;
  start_date: string;
  end_date: string;
  live_mode: boolean;
  day_count: number;
  has_legacy_achievements: boolean;
  members: LiveMember[];
  awards: AwardEntry[];
  teams: Record<Contest, LiveTeam[]>;
  stages: LiveStage[];
  cups: LiveCup[];
  standings: Record<Contest, ContestStanding>;
}

export interface TeamInput {
  id?: number;
  name: string;
  member_ids: string[];
}

export interface StageInput {
  number: number;
  title: string | null;
  scores: Record<number, number>;
}

export interface CupInput {
  team_id: number;
  title: string | null;
}
