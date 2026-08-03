// Mirror of server types/event.ts. Смена-событие: искры выдаются руками,
// название и число вводит админ.
export interface EventAward {
  id: number;
  user_id: string;
  title: string;
  amount: number;
  published: boolean;
  opened: boolean;
  in_rating: boolean;
  created_at: string;
}

export interface EventMember {
  user_id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  awarded: number;
  pending: number;
  prize: number | null;
  prize_opened: boolean;
}

export interface EventBoard {
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  event_mode: boolean;
  members: EventMember[];
  awards: EventAward[];
  prize_count: number;
  prize_opened_count: number;
}
