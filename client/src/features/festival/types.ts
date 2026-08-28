// DTO фестиваля — зеркало `server/src/types/festival.ts`. Общих пакетов в
// проекте нет, контракт повторяется руками.

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

export interface FestivalNext {
  kind: "station" | "lap";
  lap: number;
  station_idx: number | null;
}

export interface FestivalStanding {
  participant_id: number;
  number: number;
  name: string;
  team: string | null;
  lap: number;
  stations_done: number;
  finished: boolean;
  finish_seconds: number | null;
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
  next: FestivalNext | null;
  score_lap: number | null;
  events: FestivalEvent[];
  points: FestivalPoint[];
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
  standings: FestivalStanding[];
  server_time: string;
}

export interface FestivalRosterRow {
  number: number;
  name: string;
  team: string | null;
  judge_name: string | null;
}
