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

// Комнаты — третий вид составов рядом с командами КТБ и КТП: в них живут по
// 5–6 человек, ими же играется Wake Up Арена. Победителя смены у комнат нет,
// поэтому в `Contest` они не входят.
export type TeamKind = Contest | "room";

// Раунд Wake Up Арены: победившая комната приносит искры каждому жителю.
export interface ArenaRound {
  id: number;
  number: number;
  title: string | null;
  day_number: number;
  winner_team_id: number | null;
}

export interface ArenaRoundInput {
  title: string | null;
  day_number: number | null; // null = последний день смены
  winner_team_id: number | null;
}

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
  day_number: number;
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

// Состояние дня смены: отдал ли админ искры детям и когда поднял флаг.
export interface LiveDayStatus {
  day_number: number;
  date: string;
  ready_at: string | null;
  revealed: boolean;
  scored_children: number;
}

export interface LiveMember {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  number: number | null;
}

// Группы раздачи составов КТБ, в порядке очереди: бывшие лучшие в команде,
// бывшие победители КТБ, остальные бывалые, новенькие.
export const DRAFT_TIERS = ["best", "winner", "member", "rookie"] as const;
export type DraftTier = (typeof DRAFT_TIERS)[number];

export interface DraftCandidate {
  user_id: string;
  tier: DraftTier;
  sparks: number;
  team_index: number;
}

export interface DraftTeamPlan {
  name: string;
  member_ids: string[];
  sparks: number;
}

// Черновик раздачи. Пересчёт даёт другую раскладку (равные искры разрываются
// случайно), поэтому сохраняется именно показанный план.
export interface KtbDraftPlan {
  teams: DraftTeamPlan[];
  candidates: DraftCandidate[];
}

export interface LiveBoard {
  shift_id: number;
  start_date: string;
  end_date: string;
  live_mode: boolean;
  day_count: number;
  has_legacy_achievements: boolean;
  members: LiveMember[];
  days: LiveDayStatus[];
  awards: AwardEntry[];
  teams: Record<TeamKind, LiveTeam[]>;
  stages: LiveStage[];
  cups: LiveCup[];
  arena: ArenaRound[];
  arena_rounds_planned: number; // 4, на пятидневках 2
  standings: Record<Contest, ContestStanding>;
  // Раскрытие составов КТБ: момент в UTC (для отсчёта) и он же «настенным»
  // временем лагеря — им заполняется datetime-local.
  ktb_reveal_at: string | null;
  ktb_reveal_local: string | null;
  ktb_opened_count: number;
}

export interface TeamInput {
  id?: number;
  name: string;
  member_ids: string[];
}

// Номера нет: этапы уходят списком в том порядке, в каком идут, и номером
// становится позиция.
export interface StageInput {
  title: string | null;
  day_number: number | null; // null = последний день смены
  scores: Record<number, number>;
}

// Строка предпросмотра выдачи за день: что именно получит ребёнок.
export interface DayAwardRow {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  number: number | null;
  items: { key: string; amount: number }[];
  xp: number;
  delta: number;
}

export interface CupInput {
  team_id: number;
  title: string | null;
}
