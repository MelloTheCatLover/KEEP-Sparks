// Смена-событие: день рождения лагеря. Ни традиций, ни человека дня — только
// именные награды, которые админ выдаёт по ходу праздника.

// Одна выданная награда глазами админа.
export interface EventAward {
  id: number;
  user_id: string;
  title: string;
  amount: number;
  published: boolean; // объявлена: карточка пришла ребёнку
  opened: boolean; // ребёнок открыл карточку — с этого момента искры засчитаны
  in_rating: boolean; // идёт ли в общий рейтинг лагеря
  created_at: string;
}

// Участник праздника в админской таблице.
export interface EventMember {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  awarded: number; // сумма опубликованных наград
  pending: number; // сумма ещё не объявленных
  prize: number | null; // разыгранный сундук (админу видно сразу)
  prize_opened: boolean;
}

// Состояние вкладки «День рождения» целиком.
export interface EventBoard {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  event_mode: boolean;
  members: EventMember[];
  awards: EventAward[];
  // Розыгрыш: сколько сундуков роздано и сколько уже открыто.
  prize_count: number;
  prize_opened_count: number;
}

// Вход выдачи: одно название и число сразу нескольким детям — команда реалити
// получает награду одним действием, а не строкой на человека.
export interface EventAwardInput {
  user_ids: string[];
  title: string;
  amount: number;
  published: boolean;
  in_rating: boolean;
}

// Строка доски праздника. Считается ровно из того, что уже засчитано:
// объявленные награды плюс открытые сундуки — иначе табло разошлось бы с
// личным счётом.
export interface EventBoardEntry {
  rank: number;
  sparks: number;
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  is_me: boolean;
}

// Награда глазами ребёнка: карточка «Твои искры за …». Неопубликованные не
// приходят вовсе, а у неоткрытых `amount` — null: число появляется только по
// нажатию, иначе его достали бы из ответа API заранее.
export interface MyEventAward {
  id: number;
  title: string;
  amount: number | null;
  opened: boolean;
  in_rating: boolean; // false = искры только для рейтинга праздника
  created_at: string;
}

// Сундук розыгрыша глазами ребёнка. `amount` приходит только после открытия:
// до этого числа нет в ответе API, иначе его достали бы из devtools.
export interface MyEventPrize {
  drawn: boolean;
  opened: boolean;
  amount: number | null;
}

// Праздник в кабинете ребёнка.
export interface MyEvent {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  sparks: number; // открытые награды + открытый сундук
  awards: MyEventAward[];
  prize: MyEventPrize | null;
}
