import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { festivalApi } from "./festival-api";
import { formatClock, numberColor } from "./format";
import { useNow } from "./use-now";
import type { FestivalBoard, FestivalStanding } from "./types";
import "./festival-screen.css";

// Экран показа: одна страница с общими результатами.
//
// Круг убран: 22 участника идут кучей, на одном рубеже стоит половина гонки, и
// сколько его ни рисуй, читаются оттуда только номера. Вместо него у каждого
// своя линейка рубежей — по ней сразу видно, кто где на дистанции.
//
// Порядок — по баллам и меняется на лету: судьи вносят баллы по ходу гонки,
// таблица переставляется сама.

const POLL_MS = 1000;
const CONFETTI = 30;

function useFonts(): void {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Unbounded:wght@800;900&family=Inter:wght@400;600;700&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

// Личное время участника: у каждого свой старт, который включил его судья.
function ownSeconds(
  s: FestivalStanding,
  now: number,
  skew: number,
): number | null {
  if (s.finished) return s.total_seconds;
  if (!s.started || !s.start_at || now === 0) return null;
  return (now - skew - new Date(s.start_at).getTime()) / 1000;
}

// Линейка дистанции: деление на каждый рубеж, широкое — закрытие круга.
function Bar({
  standing,
  laps,
  stations,
  color,
}: {
  standing: FestivalStanding;
  laps: number;
  stations: number;
  color: string;
}) {
  const total = laps * (stations + 1);
  const done = (standing.lap - 1) * (stations + 1) + standing.stations_done;

  return (
    <div className="fest-bar">
      {Array.from({ length: total }, (_, i) => {
        const isLap = (i + 1) % (stations + 1) === 0;
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
            style={passed || current ? { background: color } : undefined}
          />
        );
      })}
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
        duration: 9 + (i % 7),
        color: ["#e40079", "#1fb2f1", "#ffffff"][i % 3],
      })),
    [],
  );

  if (error) return <div className="fest-empty">{error}</div>;
  if (!board) return <div className="fest-empty">Загрузка…</div>;

  const { race } = board;
  // Первый — у кого больше баллов; при равенстве выше тот, кто дальше по
  // дистанции и быстрее.
  const rows = [...board.standings].sort(
    (a, b) =>
      b.points - a.points || a.time_rank - b.time_rank || a.number - b.number,
  );
  // Две колонки: первая половина слева, вторая справа.
  const half = Math.ceil(rows.length / 2);

  return (
    <div className="fest">
      <div className="fest-beams" aria-hidden>
        {[10, 30, 50, 70, 90].map((left, i) => (
          <span
            key={left}
            className="fest-beam"
            style={{ left: `${left}vw`, animationDelay: `${i * 1.7}s` }}
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
        <h1 className="fest-title">{race.title}</h1>
        <div className="fest-rule" />
      </header>

      <div className="fest-table" style={{ "--rows": half } as CSSProperties}>
        {rows.map((s, i) => {
          const seconds = ownSeconds(s, now, skew);
          const color = numberColor(s.color, s.team);
          const passed = (s.lap - 1) * race.stations + s.stations_done;
          return (
            <div
              key={s.participant_id}
              className={
                "fest-row" +
                (s.finished ? " fest-row--done" : "") +
                (s.started ? "" : " fest-row--idle")
              }
              // Рамка — цветом номера из палитры; место в сетке задаётся
              // переменными, чтобы смена позиции ехала анимацией.
              style={
                {
                  borderColor: color,
                  "--col": i < half ? 0 : 1,
                  "--row": i < half ? i : i - half,
                } as CSSProperties
              }
            >
              <div className="fest-rank">{i + 1}</div>
              <div className="fest-num" style={{ background: color }}>
                {s.number}
              </div>
              <div className="fest-who">
                <div className="fest-name">{s.name}</div>
                <Bar
                  standing={s}
                  laps={race.laps}
                  stations={race.stations}
                  color={color}
                />
                <div className="fest-sub">
                  {s.team ?? "—"} · {passed} из {race.stations * race.laps} рубежей
                </div>
              </div>
              {seconds === null ? (
                <div className="fest-time fest-time--idle">на старте</div>
              ) : (
                <div className={"fest-time" + (s.finished ? " fest-time--done" : "")}>
                  {formatClock(seconds)}
                  {s.penalties > 0 && (
                    <div className="fest-pen">+{s.penalty_seconds}с</div>
                  )}
                </div>
              )}
              <div className="fest-points">
                <div className="fest-points-value">{s.points}</div>
                <div className="fest-points-label">баллов</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
