import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { festivalApi } from "./festival-api";
import { formatClock, teamColor } from "./format";
import { useNow } from "./use-now";
import type { FestivalBoard, FestivalStanding } from "./types";
import "./festival-screen.css";

// Экран показа: один кадр 4:3 на проектор, только чтение.
//
// Круг с фишками не выдержал 22 участников: на одном рубеже их скапливается
// половина гонки, и ни номера, ни фамилии не прочитать. Поэтому трек показан
// дорожками — строка на участника, деления рубежей заполняются по ходу. Все
// 22 видны всегда, имена читаются, а скопление на рубеже видно по тому, что у
// нескольких дорожек горит одно и то же деление.

const POLL_MS = 1000;
const CONFETTI = 34;

function useFonts(): void {
  // Шрифты подключаются только на этом экране: остальному сайту они не нужны.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Unbounded:wght@800;900&family=Inter:wght@400;600&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

// Сколько точек участник прошёл: рубежи плюс закрытия кругов.
function marksOf(s: FestivalStanding, stations: number): number {
  return (s.lap - 1) * (stations + 1) + s.stations_done;
}

function Lane({
  standing,
  board,
  now,
  skew,
}: {
  standing: FestivalStanding;
  board: FestivalBoard;
  now: number;
  skew: number;
}) {
  const { race } = board;
  const total = race.laps * (race.stations + 1);
  const done = marksOf(standing, race.stations);

  // Секундомер личный: у каждого свой старт, который включил его судья.
  const running =
    standing.started && !standing.finished && standing.start_at && now > 0
      ? (now - skew - new Date(standing.start_at).getTime()) / 1000
      : null;

  return (
    <div
      className={
        "fest-lane" +
        (standing.finished ? " fest-lane--done" : "") +
        (standing.started ? "" : " fest-lane--idle")
      }
    >
      <div className="fest-place">{standing.time_rank}</div>
      <div className="fest-badge" style={{ background: teamColor(standing.team) }}>
        {standing.number}
      </div>
      <div className="fest-who">
        <div className="fest-name">{standing.name}</div>
        <div className="fest-team">{standing.team ?? "—"}</div>
      </div>
      <div className="fest-track">
        {Array.from({ length: total }, (_, i) => {
          const isLap = (i + 1) % (race.stations + 1) === 0;
          const passed = i < done;
          const current = i === done && standing.started && !standing.finished;
          return (
            <span
              key={i}
              className={
                "fest-tick" +
                (isLap ? " fest-tick--lap" : "") +
                (passed ? " fest-tick--done" : "") +
                (current ? " fest-tick--now" : "")
              }
            />
          );
        })}
      </div>
      <div className="fest-right">
        {standing.finished ? (
          <>
            <div className="fest-clock fest-clock--done">
              {formatClock(standing.total_seconds ?? 0)}
            </div>
            <div className="fest-sub">
              {standing.penalties > 0 && <b>+{standing.penalty_seconds}с </b>}
              <span className="fest-pts">{standing.points} б.</span>
            </div>
          </>
        ) : running !== null ? (
          <>
            <div className="fest-clock">{formatClock(running)}</div>
            <div className="fest-sub">
              {standing.penalties > 0 && <b>+{standing.penalty_seconds}с </b>}
              <span className="fest-pts">{standing.points} б.</span>
            </div>
          </>
        ) : (
          <>
            <div className="fest-clock fest-clock--idle">на старте</div>
            <div className="fest-sub">
              <span className="fest-pts">{standing.points} б.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ScreenPage() {
  const { slug = "" } = useParams();
  const [board, setBoard] = useState<FestivalBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Часы идут по серверному времени: ноутбук на сцене может отставать.
  const [skew, setSkew] = useState(0);
  const now = useNow(250);
  useFonts();

  useEffect(() => {
    let active = true;
    let loaded = false;
    async function tick(): Promise<void> {
      try {
        const next = await festivalApi.board(slug);
        if (!active) return;
        setSkew(Date.now() - new Date(next.server_time).getTime());
        loaded = true;
        setBoard(next);
        setError(null);
      } catch {
        // Сеть моргнула — оставляем последний кадр, он честнее пустого экрана.
        if (active && !loaded) setError("Гонка не найдена");
      }
    }
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [slug]);

  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 12) * 1.1,
        duration: 8 + (i % 7),
        color: ["#e40079", "#1fb2f1", "#ffffff"][i % 3],
      })),
    [],
  );

  const lanes = useMemo(() => {
    if (!board) return [];
    return [...board.standings].sort(
      (a, b) => a.time_rank - b.time_rank || a.number - b.number,
    );
  }, [board]);

  if (error) return <div className="fest-empty">{error}</div>;
  if (!board) return <div className="fest-empty">Загрузка…</div>;

  const running = board.standings.filter((s) => s.started && !s.finished).length;
  const finished = board.standings.filter((s) => s.finished).length;

  return (
    <div className="fest">
      <div className="fest-beams" aria-hidden>
        {[12, 30, 50, 70, 88].map((left, i) => (
          <span
            key={left}
            className="fest-beam"
            style={{ left: `${left}cqw`, animationDelay: `${i * 1.7}s` }}
          />
        ))}
      </div>
      <div className="fest-confetti" aria-hidden>
        {confetti.map((c, i) => (
          <i
            key={i}
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      <header className="fest-head">
        <div className="fest-head-side">
          {board.race.laps} круга · {board.race.stations} рубежей
        </div>
        <div>
          <h1 className="fest-title">{board.race.title}</h1>
          <div className="fest-rule" />
        </div>
        <div className="fest-head-side fest-head-side--right">
          {board.race.finished_at
            ? "гонка завершена"
            : `на дистанции ${running} · финиш ${finished}`}
        </div>
      </header>

      <div className="fest-lanes">
        <div className="fest-legend" style={{ gridColumn: "1 / -1" }}>
          {board.stations.map((s) => (
            <span key={s.idx}>
              <b>{s.idx}</b> {s.name}
            </span>
          ))}
          <span>
            <b>■</b> круг · штраф +{board.race.penalty_seconds} с
          </span>
        </div>
        {lanes.map((s) => (
          <Lane
            key={s.participant_id}
            standing={s}
            board={board}
            now={now}
            skew={skew}
          />
        ))}
      </div>
    </div>
  );
}
