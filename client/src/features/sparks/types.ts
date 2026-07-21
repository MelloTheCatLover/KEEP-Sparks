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

// Строка карточки дня: ключ достижения и сколько раз получено. Без искр за
// пункт — коэффициент накладывается на день целиком, поэтому пункты не
// сложились бы в delta.
export interface LiveDayItem {
  key: string;
  amount: number;
}

// Прогресс смены, которая идёт прямо сейчас. Дни приходят только раскрытые
// (в 12:00 следующего дня) — сервер закрытые не отдаёт.
export interface LiveShiftProgress {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  day_count: number;
  sparks: number;
  days: LiveDay[];
  pending: LiveDay | null;
  next_reveal_at: string | null;
}

export interface MyBreakdown {
  summary: SparksSummary; // overall ranking placement
  current: SparksSummary | null; // current ranking placement (null when excluded)
  totals: Record<string, number>;
  shifts: MyShiftStat[];
  bonuses: SparkAdjustment[]; // positive adjustments only
  live: LiveShiftProgress | null; // shift being run right now, if any
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
