// Фестиваль: биатлон по кругу. Полностью отдельная от искр подсистема —
// участники здесь просто номера, никаких начислений и связи с детьми.

export interface FestivalRace {
  id: number;
  title: string;
  slug: string;
  laps: number;
  stations: number;
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
  kind: "station" | "lap";
  station_idx: number | null;
  lap: number;
  at: string;
}

export interface FestivalPoint {
  id: number;
  participant_id: number;
  lap: number;
  points: number;
  note: string | null;
  at: string;
}

// Следующая точка участника. Однозначно выводится из уже отмеченного:
// рубежи идут по порядку, после последнего — закрытие круга.
export interface FestivalNext {
  kind: "station" | "lap";
  lap: number;
  station_idx: number | null;
}

// Строка табло. Всё, кроме имени и номера, посчитано из событий при чтении.
export interface FestivalStanding {
  participant_id: number;
  number: number;
  name: string;
  team: string | null;
  lap: number; // текущий круг (у финишировавших — последний)
  stations_done: number; // рубежей пройдено на текущем круге
  finished: boolean;
  finish_seconds: number | null;
  last_at: string | null;
  points: number;
  time_rank: number;
  points_rank: number;
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
  next: FestivalNext | null; // null — участник финишировал
  // Баллы вносятся за завершённый круг: до первого закрытия круга их нет.
  score_lap: number | null;
  events: FestivalEvent[];
  points: FestivalPoint[];
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
  standings: FestivalStanding[];
  server_time: string;
}

export interface FestivalRaceInput {
  title: string;
  slug: string;
  laps: number;
  stations: number;
}

export interface FestivalRosterRow {
  number: number;
  name: string;
  team: string | null;
  judge_name: string | null;
}
