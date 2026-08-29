import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { festivalApi } from "./festival-api";
import { formatClock, numberColor } from "./format";
import { useNow } from "./use-now";
import type { FestivalBoard, FestivalStanding } from "./types";
import "./festival-screen.css";

// Экран показа. Две страницы:
//   /festival/screen/:slug        — чередуются круг и таблица
//   /festival/screen/:slug/ring   — только круг
//   /festival/screen/:slug/table  — только таблица
//
// Круг — главный вид: рубежи стоят по окружности, у каждого висит карточка с
// номерами тех, кто сейчас к нему идёт. Только номера: имена и время на круге
// не читаются, для них есть вторая страница — там видно, сколько рубежей
// пройдено и сколько набрано баллов.

const POLL_MS = 1000;
// Больше двенадцати номеров в карточке не помещается — остальные считаем числом.
const CLUSTER_LIMIT = 12;
const ROTATE_MS = 18000;
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

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

function Dot({ s }: { s: FestivalStanding }) {
  return (
    <div
      className={"fest-dot" + (s.finished ? " fest-dot--done" : "")}
      style={{ background: numberColor(s.color, s.team) }}
    >
      {s.number}
    </div>
  );
}

function Ring({ board }: { board: FestivalBoard }) {
  const { race, stations, standings } = board;
  const points = race.stations + 1; // рубежи плюс линия старта-финиша
  const step = 360 / points;

  // Участник стоит у того рубежа, к которому идёт: прошёл третий — ждём его на
  // четвёртом. У линии старта-финиша собираются те, кто ещё не ушёл, кто
  // добивает круг и кто уже финишировал.
  const clusters = useMemo(() => {
    const at = (idx: number): FestivalStanding[] =>
      standings
        .filter(
          (s) =>
            s.started &&
            !s.finished &&
            s.stations_done === idx - 1 &&
            idx <= race.stations,
        )
        .sort((a, b) => a.number - b.number);

    const line = standings
      .filter((s) => !s.started || s.finished || s.stations_done === race.stations)
      .sort((a, b) => a.time_rank - b.time_rank || a.number - b.number);

    // Линия ближе к центру: у верхней точки круга иначе не хватает места —
    // перед стартом там стоят все 22.
    return [
      { key: 0, angle: 0, radius: 37, title: "Старт / финиш", members: line },
      ...stations.map((st) => ({
        key: st.idx,
        angle: st.idx * step,
        radius: 46,
        title: `${st.idx}. ${st.name}`,
        members: at(st.idx),
      })),
    ];
  }, [standings, stations, race.stations, step]);

  return (
    <div className="fest-ring">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <circle cx={50} cy={50} r={30} fill="none" stroke="rgba(23,137,211,.18)" strokeWidth={7} />
        <circle cx={50} cy={50} r={30} fill="none" stroke="rgba(120,180,255,.35)" strokeWidth={0.5} />
        {/* Линия старта и финиша */}
        <rect x={49.4} y={16} width={1.2} height={8} rx={0.4} fill="#fff" opacity={0.9} />
        {stations.map((st) => {
          const p = polar(st.idx * step, 30);
          return (
            <g key={st.idx}>
              <circle cx={p.x} cy={p.y} r={2.6} fill="#000a2e" stroke="#1fb2f1" strokeWidth={0.6} />
              <text
                x={p.x}
                y={p.y + 1}
                textAnchor="middle"
                fontSize={2.6}
                fontWeight={700}
                fill="#fff"
              >
                {st.idx}
              </text>
            </g>
          );
        })}
      </svg>

      {clusters.map((c) => {
        const pos = polar(c.angle, c.radius);
        const shown = c.members.slice(0, CLUSTER_LIMIT);
        const rest = c.members.length - shown.length;
        return (
          <div
            key={c.key}
            className={
              "fest-cluster" + (shown.length > 6 ? " fest-cluster--wide" : "")
            }
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className="fest-cluster-head">
              <span>{c.title}</span>
              <b>{c.members.length}</b>
            </div>
            <div className="fest-cluster-body">
              {shown.map((s) => (
                <Dot key={s.participant_id} s={s} />
              ))}
            </div>
            {rest > 0 && <div className="fest-cluster-more">и ещё {rest}</div>}
          </div>
        );
      })}

    </div>
  );
}

function Table({
  board,
  now,
  skew,
}: {
  board: FestivalBoard;
  now: number;
  skew: number;
}) {
  const rows = [...board.standings].sort(
    (a, b) => a.time_rank - b.time_rank || a.number - b.number,
  );

  const stations = board.race.stations;
  const totalStations = stations * board.race.laps;

  return (
    <div className="fest-table">
      {rows.map((s) => {
        const seconds = ownSeconds(s, now, skew);
        // Сколько рубежей пройдено за всю гонку, а не только на этом круге.
        const passed = (s.lap - 1) * stations + s.stations_done;
        return (
          <div
            key={s.participant_id}
            className={
              "fest-row" +
              (s.finished ? " fest-row--done" : "") +
              (s.started ? "" : " fest-row--idle")
            }
          >
            <div className="fest-rank">{s.time_rank}</div>
            <div
              className="fest-num"
              style={{ background: numberColor(s.color, s.team) }}
            >
              {s.number}
            </div>
            <div>
              <div className="fest-name">{s.name}</div>
              <div className="fest-sub">{s.team ?? "—"}</div>
            </div>
            <div className="fest-meta">
              <div className="fest-meta-big">
                {passed}/{totalStations}
              </div>
              <div>рубежей · круг {s.lap}</div>
            </div>
            {seconds === null ? (
              <div className="fest-time fest-time--idle">на старте</div>
            ) : (
              <div className={"fest-time" + (s.finished ? " fest-time--done" : "")}>
                {formatClock(seconds)}
              </div>
            )}
            <div className="fest-meta">
              <div className="fest-meta-big">{s.points}</div>
              <div>
                {s.penalties > 0 ? (
                  <u>+{s.penalty_seconds}с</u>
                ) : (
                  "баллов"
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScreenPage() {
  const { slug = "", view } = useParams();
  const [board, setBoard] = useState<FestivalBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Часы идут по серверному времени: ноутбук на сцене может отставать.
  const [skew, setSkew] = useState(0);
  const [auto, setAuto] = useState<"ring" | "table">("ring");
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

  // Без явной страницы виды чередуются сами — на проекторе никто не кликает.
  useEffect(() => {
    if (view) return;
    const id = setInterval(
      () => setAuto((v) => (v === "ring" ? "table" : "ring")),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [view]);

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

  const shown = view === "table" || view === "ring" ? view : auto;

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
        <h1 className="fest-title">{board.race.title}</h1>
        <div className="fest-rule" />
      </header>

      {shown === "ring" ? (
        <div className="fest-stage">
          <Ring board={board} />
        </div>
      ) : (
        <Table board={board} now={now} skew={skew} />
      )}
    </div>
  );
}
