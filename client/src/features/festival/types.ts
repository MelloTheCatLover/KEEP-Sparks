// DTO фестиваля — зеркало `server/src/types/festival.ts`. Общих пакетов в
// проекте нет, контракт повторяется руками.

export interface FestivalRace {
  id: number;
  title: string;
  slug: string;
  laps: number;
  stations: number;
  penalty_seconds: number; // сколько секунд добавляет один штраф
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
  // Цвет номера на экране показа из палитры. Пусто — цвет по команде.
  color: string | null;
}

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

export interface FestivalPenalty {
  id: number;
  participant_id: number;
  lap: number;
  at: string;
}

export interface FestivalNext {
  kind: "start" | "station" | "lap";
  lap: number;
  station_idx: number | null;
}

export interface FestivalStanding {
  participant_id: number;
  number: number;
  name: string;
  team: string | null;
  color: string | null;
  started: boolean;
  start_at: string | null; // от него идёт личный секундомер участника
  lap: number;
  stations_done: number;
  finished: boolean;
  clean_seconds: number | null;
  penalties: number;
  penalty_seconds: number;
  total_seconds: number | null;
  last_at: string | null;
  points: number;
  time_rank: number;
  points_rank: number;
}

export interface FestivalBoard {
  race: FestivalRace;
  stations: FestivalStation[];
  standings: FestivalStanding[];
  server_time: string;
}

export interface FestivalJudgeView {
  race: FestivalRace;
  judge: { id: number; name: string | null };
  participant: FestivalParticipant;
  stations: FestivalStation[];
  // Своя строка табло и табло целиком — судья видит, где его номер. То же
  // самое висит на публичном экране показа, секрета тут нет.
  standing: FestivalStanding;
  standings: FestivalStanding[];
  next: FestivalNext | null;
  score_lap: number | null;
  events: FestivalEvent[];
  points: FestivalPoint[];
  penalties: FestivalPenalty[];
  total_points: number;
  server_time: string;
}

export interface FestivalAdminBoard {
  race: FestivalRace;
  stations: FestivalStation[];
  participants: FestivalParticipant[];
  judges: FestivalJudge[];
  events: FestivalEvent[];
  points: FestivalPoint[];
  penalties: FestivalPenalty[];
  standings: FestivalStanding[];
  server_time: string;
}

export interface FestivalRosterRow {
  number: number;
  name: string;
  team: string | null;
  judge_name: string | null;
}

export interface FestivalRaceSettings {
  title: string;
  laps: number;
  stations: number;
  penalty_seconds: number;
}
