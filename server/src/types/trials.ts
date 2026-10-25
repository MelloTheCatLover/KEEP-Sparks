// Испытания смены — внутренняя игра со своими баллами (134 смена, «Разбитый
// парк»). С искрами не связаны.

// Испытание в админской таблице.
export interface Trial {
  id: number;
  day: number;
  title: string;
  published: boolean;
  scored: number; // скольким детям загружены баллы
}

// Участник смены в админской таблице: баллы по каждому испытанию и итог.
export interface TrialMember {
  user_id: string;
  number: number | null;
  f_name: string;
  m_name: string | null;
  l_name: string;
  // trial id → баллы; нет ключа — в испытании баллов нет.
  scores: Record<string, number>;
  total: number; // по всем испытаниям, включая неопубликованные
  place: number;
}

// Вкладка «Испытания» одной смены целиком.
export interface TrialBoard {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  days: number; // длина смены в днях — верхняя граница номера дня
  trials: Trial[];
  members: TrialMember[];
}

// Строка загружаемой таблицы: «номер ФИО баллы». Номер может отсутствовать —
// тогда ребёнок ищется по ФИО.
export interface TrialScoreRow {
  number: number | null;
  name: string;
  points: number;
}

// Как сервер понял строку загрузки.
//   ok        — найден, ФИО сходится;
//   mismatch  — найден по номеру, но ФИО другое (сохранится, но проверьте);
//   unknown   — ни по номеру, ни по ФИО никого;
//   ambiguous — без номера, и по ФИО подходит несколько;
//   duplicate — этот ребёнок уже встретился выше.
export type TrialRowStatus =
  | "ok"
  | "mismatch"
  | "unknown"
  | "ambiguous"
  | "duplicate";

export interface TrialRowMatch {
  line: number; // порядковый номер строки в загрузке, с 1
  number: number | null;
  name: string;
  points: number;
  status: TrialRowStatus;
  user_id: string | null;
  matched_name: string | null; // ФИО из ростера
  matched_number: number | null;
}

export interface TrialUploadResult {
  applied: boolean;
  rows: TrialRowMatch[];
  board: TrialBoard;
}

// Испытание глазами ребёнка.
export interface MyTrial {
  id: number;
  title: string;
  points: number | null; // null — не участвовал
  place: number | null; // место среди тех, у кого есть баллы
  scored: number; // сколько детей получили баллы
}

export interface MyTrialDay {
  day: number;
  total: number;
  trials: MyTrial[];
}

// Строка табло смены. Чужая фамилия — только первой буквой: табло видят все
// участники, полное ФИО ребёнку о других знать незачем.
export interface TrialBoardRow {
  place: number;
  number: number | null;
  name: string; // «Варвара К.»
  total: number;
  delta: number; // сколько принёс последний открытый день
  is_me: boolean;
}

export interface MyTrials {
  shift_id: number;
  name: string | null;
  me: {
    f_name: string;
    l_name: string;
    number: number | null;
  };
  total: number; // сумма по всем опубликованным испытаниям
  place: number; // место по сумме среди всей смены
  participants: number; // ростер смены
  last_day: number; // последний день с открытым испытанием
  board: TrialBoardRow[];
  days: MyTrialDay[];
}
