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

// Manual spark adjustment. amount > 0 bonus (shown to child), < 0 penalty (hidden).
export interface SparkAdjustment {
  id: number;
  user_id: string;
  amount: number;
  reason: string | null;
  created_at: string;
}

// Один раскрытый день ведущейся смены. delta — прирост итога за этот день:
// разница двух округлённых нарастающих итогов, поэтому приросты складываются
// в sparks точно.
export interface LiveDay {
  day_number: number;
  date: string;
  delta: number;
  opened: boolean;
  items: LiveDayItem[];
}

// Строка карточки дня: ключ достижения, сколько раз получено и сколько это
// стоит. xp — каталожная цена (value * amount) до коэффициента смены, поэтому
// пункты складываются в меньшее, чем delta. Карточка про это говорит прямо.
export interface LiveDayItem {
  key: string;
  amount: number;
  value: number;
  xp: number;
}

// Прогресс смены, которая идёт прямо сейчас. Приходят только дни, за которые
// админ отдал искры, — сервер остальные не отдаёт.
export interface LiveShiftProgress {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  day_count: number;
  sparks: number;
  days: LiveDay[];
  pending: LiveDay | null;
}

// Сокомандник в карточке раскрытия составов КТБ.
export interface KtbTeammate {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  is_me: boolean;
}

// Команда КТБ глазами ребёнка. До reveal_at сервер состав не отдаёт вовсе
// (team === null) — в ответе API имён нет, только час раскрытия.
export interface MyKtbTeam {
  shift_id: number;
  reveal_at: string;
  revealed: boolean;
  opened: boolean;
  team: { name: string; members: KtbTeammate[] } | null;
}

// Награда дня рождения глазами ребёнка. Неопубликованные не приходят вовсе.
export interface MyEventAward {
  id: number;
  title: string;
  amount: number | null; // null, пока карточка не открыта
  opened: boolean;
  in_rating: boolean; // false = искры только для рейтинга праздника
  created_at: string;
}

// Строка доски праздника: засчитанные искры за день рождения.
export interface EventBoardEntry {
  rank: number;
  sparks: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  is_me: boolean;
}

// Сундук розыгрыша. amount приходит только после открытия — до этого сервер
// его не отдаёт.
export interface MyEventPrize {
  drawn: boolean;
  opened: boolean;
  amount: number | null;
}

// Смена-событие в кабинете: объявленные награды и их сумма. Коэффициента здесь
// нет — числа ровно те, что объявил админ.
export interface MyEvent {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  sparks: number;
  awards: MyEventAward[];
  prize: MyEventPrize | null;
}

export interface MyBreakdown {
  summary: SparksSummary; // overall ranking placement
  current: SparksSummary | null; // current ranking placement (null when excluded)
  totals: Record<string, number>;
  shifts: MyShiftStat[];
  bonuses: SparkAdjustment[]; // positive adjustments only
  live: LiveShiftProgress | null; // shift being run right now, if any
  ktb: MyKtbTeam | null; // команда КТБ: отсчёт, потом сундук
  event: MyEvent | null; // день рождения лагеря: объявленные награды
}

// Public sparks board row: name + score, no login.
export interface BoardEntry {
  rank: number;
  sparks: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

export interface ChildBreakdown extends MyBreakdown {
  f_name: string;
  m_name: string | null;
  l_name: string;
}
