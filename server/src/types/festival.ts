// Фестиваль: биатлон по кругу. Полностью отдельная от искр подсистема —
// участники здесь просто номера, никаких начислений и связи с детьми.

export interface FestivalRace {
  id: number;
  title: string;
  slug: string;
  laps: number;
  stations: number;
  penalty_seconds: number; // сколько секунд добавляет один штраф
  heat_size: number; // по сколько человек уходит со старта (шестёрки)
  voting_open: boolean; // финальное голосование зрителей принимает голоса
  results_published: boolean; // финальные итоги объявлены зрителям
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface FestivalStation {
  idx: number;
  name: string;
}

export interface FestivalParticipant {
  id: number;
  number: number;
  name: string;
  team: string | null;
  heat: number;
  // Цвет номера на экране показа из палитры. Пусто — цвет по команде.
  color: string | null;
  // Участник финального голосования зрителей.
  finalist: boolean;
}

// Судья глазами админа: PIN нужен, чтобы его напечатать и раздать.
export interface FestivalJudge {
  id: number;
  participant_id: number;
  name: string | null;
  pin: string;
}

export interface FestivalEvent {
  id: number;
  participant_id: number;
  // 'start' — судья включил отсчёт своему участнику; отсчёт индивидуальный.
  kind: "start" | "station" | "lap";
  station_idx: number | null;
  lap: number;
  at: string;
}

export interface FestivalPoint {
  id: number;
  participant_id: number;
  lap: number;
  points: number;
  at: string;
}

// Штраф: одна строка — один штраф, в итоговое время добавляет
// `race.penalty_seconds`.
export interface FestivalPenalty {
  id: number;
  participant_id: number;
  lap: number;
  at: string;
}

// Следующая точка участника. Однозначно выводится из уже отмеченного:
// рубежи идут по порядку, после последнего — закрытие круга.
export interface FestivalNext {
  kind: "start" | "station" | "lap";
  lap: number;
  station_idx: number | null;
}

// Строка табло. Всё, кроме имени и номера, посчитано из событий при чтении.
export interface FestivalStanding {
  participant_id: number;
  number: number;
  name: string;
  team: string | null;
  heat: number;
  color: string | null;
  started: boolean;
  start_at: string | null; // от него идёт личный секундомер участника
  lap: number; // текущий круг (у финишировавших — последний)
  stations_done: number; // рубежей пройдено на текущем круге
  finished: boolean;
  clean_seconds: number | null; // чистое время от своего старта до финиша
  penalties: number;
  penalty_seconds: number; // штрафное время: penalties * race.penalty_seconds
  total_seconds: number | null; // итог: чистое время плюс штрафы
  last_at: string | null;
  points: number;
  time_rank: number;
  points_rank: number;
  // Итоговое место: сумма мест по времени и по баллам, при равенстве выше тот,
  // кто быстрее.
  overall_rank: number;
}

// Ответ публичного экрана показа.
export interface FestivalBoard {
  race: FestivalRace;
  stations: FestivalStation[];
  standings: FestivalStanding[];
  server_time: string;
}

// Ответ судейского экрана: свой участник и что с ним делать дальше.
export interface FestivalJudgeView {
  race: FestivalRace;
  judge: { id: number; name: string | null };
  participant: FestivalParticipant;
  stations: FestivalStation[];
  // Своя строка табло и табло целиком: судья должен видеть, где его номер
  // относительно остальных, — иначе он не знает, подгонять своего или нет.
  // Секрета в этом нет: то же самое висит на экране показа.
  standing: FestivalStanding;
  standings: FestivalStanding[];
  next: FestivalNext | null; // null — участник финишировал
  // Баллы вносятся за завершённый круг: до первого закрытия круга их нет.
  score_lap: number | null;
  events: FestivalEvent[];
  points: FestivalPoint[];
  penalties: FestivalPenalty[];
  total_points: number;
  server_time: string;
}

// Полное состояние гонки для админа — вместе с PIN и сырыми логами.
export interface FestivalAdminBoard {
  race: FestivalRace;
  stations: FestivalStation[];
  participants: FestivalParticipant[];
  judges: FestivalJudge[];
  events: FestivalEvent[];
  points: FestivalPoint[];
  penalties: FestivalPenalty[];
  standings: FestivalStanding[];
  votes: FestivalVoteTally;
  server_time: string;
}

// Бюллетень для телефона зрителя: только то, из чего рисуется выбор.
export interface FestivalBallot {
  title: string;
  slug: string;
  voting_open: boolean;
  candidates: FestivalCandidate[];
}

export interface FestivalCandidate {
  participant_id: number;
  number: number;
  name: string;
  team: string | null;
  color: string | null;
}

// Счёт голосов. Голоса анонимные, поэтому «кто за кого» — это счёт по
// кандидатам и время последнего голоса, имён голосующих нигде нет.
export interface FestivalVoteTally {
  voting_open: boolean;
  total: number;
  rows: FestivalVoteRow[];
  server_time: string;
}

export interface FestivalVoteRow extends FestivalCandidate {
  votes: number;
  last_at: string | null;
}

export interface FestivalRaceInput {
  title: string;
  slug: string;
  laps: number;
  stations: number;
  penalty_seconds: number;
  heat_size: number;
}

export interface FestivalRosterRow {
  number: number;
  name: string;
  team: string | null;
  judge_name: string | null;
  // Не задана — считается из номера и размера группы гонки.
  heat: number | null;
}

// Настройки гонки, которые админ правит на странице. Круги и рубежи меняются
// только пока нет отметок: иначе уже пройденная дистанция поедет.
export interface FestivalRaceSettings {
  title: string;
  laps: number;
  stations: number;
  penalty_seconds: number;
  // Размер стартовой группы на экранах не показывается — номера вызывают по
  // порядку, а время у каждого своё. Поле осталось для разбивки ростера и в
  // запросе необязательно.
  heat_size?: number;
}
