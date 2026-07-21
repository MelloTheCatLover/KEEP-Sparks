// «Ведение смены» — сырые факты традиций, из которых считаются достижения.

// Именные награды. Ключ совпадает с settings.name; ежедневные несут day_number.
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

// Достижения, которыми владеет режим ведения: пересчёт переписывает их целиком.
// Остальные (звёзды, день присутствия) остаются за ручной сеткой.
export const LIVE_SETTING_KEYS: string[] = [
  ...DAILY_AWARD_KINDS,
  ...FINAL_AWARD_KINDS,
  "ktb_stage",
  "ktb_winner",
  "kgg_cup",
  "kgg_winner",
];

export interface AwardEntry {
  kind: AwardKind;
  day_number: number; // 0 для наград в конце смены
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
  scores: Record<number, number>; // team_id → баллы
  winner_team_ids: number[]; // максимум баллов; несколько при равенстве
}

export interface LiveCup {
  id: number;
  team_id: number;
  title: string | null;
}

// Итоги контеста: сумма баллов / число кубков по командам, лидеры и то, кого
// в итоге записали победителем (ручной выбор или единственный лидер).
export interface ContestStanding {
  totals: Record<number, number>; // team_id → сумма баллов (КТБ) или кубков (КТП)
  leader_team_ids: number[]; // команды с максимумом (>1 = ничья)
  manual_team_id: number | null; // ручной выбор админа
  winner_team_id: number | null; // применённый победитель
}

export interface LiveMember {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  number: number | null;
}

// Полное состояние страницы «Ведение» одной смены.
export interface LiveBoard {
  shift_id: number;
  start_date: string;
  end_date: string;
  live_mode: boolean;
  day_count: number;
  // Есть ли у смены достижения по «живым» ключам вне режима ведения — тогда
  // включение режима перезапишет их.
  has_legacy_achievements: boolean;
  members: LiveMember[];
  awards: AwardEntry[];
  teams: Record<Contest, LiveTeam[]>;
  stages: LiveStage[];
  cups: LiveCup[];
  standings: Record<Contest, ContestStanding>;
}

// Вход мутаций. Каждая заменяет свой срез целиком и запускает пересчёт.
export interface AwardInput {
  kind: AwardKind;
  day_number: number;
  user_ids: string[];
}

export interface TeamInput {
  id?: number; // отсутствует у новой команды
  name: string;
  member_ids: string[];
}

export interface TeamsInput {
  contest: Contest;
  teams: TeamInput[];
}

export interface StageInput {
  id?: number;
  number: number;
  title: string | null;
  scores: Record<number, number>;
}

export interface CupInput {
  team_id: number;
  title: string | null;
}
