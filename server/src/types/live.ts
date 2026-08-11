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

// Виды составов в `shift_team`. Комнаты — третий вид рядом с командами КТБ и
// КТП: в них живут по 5–6 человек, и ими же играется Wake Up Арена. Итога
// «победитель контеста» у комнат нет, поэтому в `Contest` они не входят.
export type TeamKind = Contest | "room";
export const TEAM_KINDS: TeamKind[] = ["ktb", "ktp", "room"];

// Раунд Wake Up Арены. За смену их 4, на пятидневках — 2. Победившая комната
// приносит `wake_up_arena_winner` каждому своему жителю; пока победитель не
// выбран, раунд никого не награждает.
export interface ArenaRound {
  id: number;
  number: number;
  title: string | null;
  day_number: number; // день смены, в который прошёл раунд
  winner_team_id: number | null;
}

export interface ArenaRoundInput {
  title: string | null;
  day_number: number | null; // null = последний день смены
  winner_team_id: number | null;
}

// Сколько раундов арены планируется на смену такой длины: 4 обычно, 2 на
// коротких (5 дней и меньше). Подсказка для UI — жёстко это не ограничивается,
// смена может пойти не по плану.
export function plannedArenaRounds(dayCount: number): number {
  return dayCount <= 5 ? 2 : 4;
}

// Достижения, которыми владеет режим ведения: пересчёт переписывает их целиком.
// Остальные (звёзды, день присутствия) остаются за ручной сеткой.
export const LIVE_SETTING_KEYS: string[] = [
  ...DAILY_AWARD_KINDS,
  ...FINAL_AWARD_KINDS,
  "ktb_stage",
  "ktb_winner",
  "kgg_cup",
  "kgg_winner",
  "wake_up_arena_winner", // победа комнаты в раунде арены
  "day", // день присутствия: начисляется всем автоматически
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
  day_number: number; // день смены, в который прошёл этап
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

// Состояние одного дня смены для админа: отданы ли искры детям (`ready_at` —
// когда админ поднял флаг) и скольким уже начислено.
export interface LiveDayStatus {
  day_number: number;
  date: string;
  ready_at: string | null;
  revealed: boolean;
  scored_children: number;
}

// Строка предпросмотра выдачи: что именно получит ребёнок за день. Приходят
// все дети ростера, включая тех, кому за день не начислено ничего.
export interface DayAwardRow {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  number: number | null;
  items: { key: string; amount: number }[];
  xp: number; // сырые искры за день, без коэффициента смены
  delta: number; // сколько прибавится ребёнку — то же число, что он увидит
}

// Группа ребёнка при подготовке составов КТБ. Порядок массива = порядок
// раздачи: сначала расходятся бывшие лучшие в команде, потом бывшие
// победители КТБ, потом остальные бывалые, новенькие — последними. Считается
// по прошлым сменам (тем, что начались раньше текущей), внутри группы
// раскладка идёт по искрам.
export const DRAFT_TIERS = ["best", "winner", "member", "rookie"] as const;
export type DraftTier = (typeof DRAFT_TIERS)[number];

export interface DraftCandidate {
  user_id: string;
  tier: DraftTier;
  sparks: number;
  team_index: number; // в какую команду плана попал (индекс в plan.teams)
}

export interface DraftTeamPlan {
  name: string;
  member_ids: string[];
  sparks: number; // сумма искр состава — по ней видно, ровно ли легло
}

// Черновик раздачи: ещё ничего не сохранено, админ смотрит и решает. Из-за
// случайного разрыва равных искр повторный расчёт даёт другую раскладку,
// поэтому сохраняется именно тот план, который админ увидел.
export interface KtbDraftPlan {
  teams: DraftTeamPlan[];
  candidates: DraftCandidate[]; // весь ростер с группой и искрами
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
  days: LiveDayStatus[];
  awards: AwardEntry[];
  teams: Record<TeamKind, LiveTeam[]>;
  stages: LiveStage[];
  cups: LiveCup[];
  arena: ArenaRound[];
  arena_rounds_planned: number; // 4, на пятидневках 2
  standings: Record<Contest, ContestStanding>;
  // Раскрытие составов КТБ. `ktb_reveal_at` — момент в UTC (для отсчёта),
  // `ktb_reveal_local` — то же «настенным» временем лагеря, чтобы им можно было
  // заполнить `datetime-local`, не угадывая таймзону браузера админа.
  ktb_reveal_at: string | null;
  ktb_reveal_local: string | null;
  ktb_opened_count: number; // сколько детей уже открыли сундук
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
  contest: TeamKind;
  teams: TeamInput[];
}

// Этап на сохранение. Номера нет: этапы приходят списком в том порядке, в
// каком идут, и номером становится позиция. Номер, введённый руками, ломался о
// UNIQUE (shift_id, number) — стоило переставить два этапа местами, как в теле
// на миг оказывались два одинаковых.
export interface StageInput {
  title: string | null;
  day_number: number | null; // null = последний день смены
  scores: Record<number, number>;
}

export interface CupInput {
  team_id: number;
  title: string | null;
}
