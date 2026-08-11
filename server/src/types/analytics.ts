// Аналитика наград: как искры расходятся по типам достижений, каково новичку
// против опытного и насколько подъёмна следующая ступенька рейтинга.
// Всё считается при чтении из сырых фактов — как и сами искры.

// Крупная группа достижений. Ключевое деление — «дали всей команде» против
// «дали лично»: именно оно отвечает на вопрос, чем на самом деле набирают.
export type AwardCategory =
  | "team_shared"
  | "team_personal"
  | "reality"
  | "stars"
  | "personal"
  | "base";

export interface CategoryStat {
  category: AwardCategory;
  xp: number; // сырые баллы (до коэффициента смены)
  pct: number; // доля от всех баллов, %
  units: number; // сколько раз выдано
  kids: number; // скольким детям хоть раз досталось
}

// Одно достижение каталога в разрезе «сколько стоит и как часто достаётся».
export interface AwardStat {
  key: string; // settings.name
  value: number; // баллов за единицу
  category: AwardCategory;
  units: number;
  xp: number;
  pct: number; // доля от всех баллов, %
  kids: number;
  shifts_present: number; // на скольких сменах вообще выдавалось
  avg_pct_roster: number; // в среднем % ростера, кому досталось за смену
  avg_xp_per_recipient: number; // средний «чек» получателя за смену
}

// Смена целиком: сколько в ней командного, как разошлись баллы, где новички.
export interface ShiftStat {
  shift_id: number;
  name: string | null;
  start_date: string;
  roster: number;
  difficulty: number;
  rookies: number;
  rookie_pct_roster: number;
  rookie_pct_xp: number; // какую долю баллов смены забрали новички
  median_rookie: number;
  median_veteran: number;
  median: number;
  max_xp: number;
  team_pct_xp: number; // доля баллов, пришедших командными наградами
  base_pct_xp: number; // доля, пришедшая днями присутствия
  gini: number; // 0 — все поровну, 1 — всё одному
}

// Одна из двух групп сравнения: новички смены и те, кто уже приезжал.
export interface CohortStat {
  cohort: "rookie" | "veteran";
  child_shifts: number; // пар «ребёнок × смена»
  median_xp: number;
  p90_xp: number;
  median_earned: number; // без дней присутствия
  pct_zero_earned: number; // % тех, кто не получил ничего, кроме дней
  avg_percentile: number; // среднее место внутри смены, 0..1 (1 = топ)
  pct_top3: number;
  pct_top10: number; // топ-10% ростера
  pct_top25: number;
  avg_team_xp: number; // средние баллы с командных наград
  pct_any_team: number; // % тех, кому командные хоть что-то принесли
}

// Полоса общего рейтинга: чего стоит подняться на одно место именно здесь.
export interface RankBand {
  band: string; // «1–10», «11–25», …
  kids: number;
  avg_sparks: number;
  median_gap: number; // медианный разрыв с соседом снизу
}

// Ступенька «сколько смен — такой итог»: видно, покупается ли рейтинг только
// количеством приездов.
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
  top10_share: number; // % всех искр у верхних 10% детей
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
