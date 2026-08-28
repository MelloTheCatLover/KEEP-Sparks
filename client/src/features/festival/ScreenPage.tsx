import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { festivalApi } from "./festival-api";
import { formatClock, teamColor } from "./format";
import { useNow } from "./use-now";
import type { FestivalBoard, FestivalStanding } from "./types";
import "./festival-screen.css";

// Экран показа: один кадр 4:3 на проектор. Только чтение — писать отсюда некуда,
// поэтому адрес можно раздавать кому угодно.

const POLL_MS = 1000;

// Круг: точка 0 — линия старта/финиша наверху, дальше по часовой стрелке
// рубежи 1..N. Точек всегда N+1, поэтому шаг делится ровно.
const CX = 50;
const CY = 50;
const R = 35;

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

// Позиция фишки: середина отрезка между пройденным рубежом и следующим.
// Внутри отрезка участники разводятся по углу, чтобы номера не наезжали.
function chipPosition(
  segment: number,
  step: number,
  indexInGroup: number,
  groupSize: number,
): [number, number] {
  const spread = Math.min(step * 0.55, 6 * Math.max(1, groupSize - 1));
  const offset =
    groupSize === 1
      ? 0
      : (indexInGroup - (groupSize - 1) / 2) * (spread / (groupSize - 1));
  const radius = R + (indexInGroup % 2 === 0 ? 0 : 5.6);
  return polar((segment + 0.5) * step + offset, radius);
}

function Track({ board }: { board: FestivalBoard }) {
  const { race, stations, standings } = board;
  const step = 360 / (race.stations + 1);

  const running = standings.filter((s) => !s.finished);
  const finished = standings.filter((s) => s.finished);

  // Группируем по отрезку: у всех в одной группе одна дуга, разводим внутри неё.
  const groups = new Map<number, FestivalStanding[]>();
  for (const s of running) {
    const list = groups.get(s.stations_done) ?? [];
    list.push(s);
    groups.set(s.stations_done, list);
  }

  const [lineX, lineY] = polar(0, R);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="var(--color-elevated)"
        strokeWidth={7}
      />
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={0.4}
      />

      {/* Линия старта и финиша */}
      <rect
        x={lineX - 0.5}
        y={lineY - 4.4}
        width={1}
        height={8.8}
        fill="var(--color-text)"
      />
      <text
        x={lineX}
        y={lineY - 6.4}
        textAnchor="middle"
        fontSize={2.6}
        fill="var(--color-text)"
      >
        СТАРТ / ФИНИШ
      </text>

      {stations.map((station) => {
        const angle = station.idx * step;
        const [x, y] = polar(angle, R);
        const [lx, ly] = polar(angle, R + 7.5);
        return (
          <g key={station.idx}>
            <circle cx={x} cy={y} r={2.6} fill="var(--color-bg)" stroke="var(--color-text-muted)" strokeWidth={0.5} />
            <text x={x} y={y + 0.9} textAnchor="middle" fontSize={2.4} fill="var(--color-text)">
              {station.idx}
            </text>
            <text x={lx} y={ly + 0.8} textAnchor="middle" fontSize={2.2} fill="var(--color-text-muted)">
              {station.name}
            </text>
          </g>
        );
      })}

      {[...groups.entries()].flatMap(([segment, list]) =>
        list.map((s, i) => {
          const [x, y] = chipPosition(segment, step, i, list.length);
          return (
            <g key={s.participant_id}>
              <circle cx={x} cy={y} r={2.8} fill={teamColor(s.team)} />
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                fontSize={2.7}
                fontWeight={600}
                fill="#101014"
              >
                {s.number}
              </text>
              {race.laps > 1 && (
                <text
                  x={x + 2.9}
                  y={y - 2.2}
                  textAnchor="middle"
                  fontSize={1.9}
                  fill="var(--color-text-muted)"
                >
                  {s.lap}
                </text>
              )}
            </g>
          );
        }),
      )}

      <text x={CX} y={CY - 2} textAnchor="middle" fontSize={3.4} fill="var(--color-text-muted)">
        {race.laps} круга · {race.stations} рубежей
      </text>
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize={3.2} fill="var(--color-text)">
        финишировали: {finished.length} из {standings.length}
      </text>
      {finished.length > 0 && (
        <text x={CX} y={CY + 9} textAnchor="middle" fontSize={2.8} fill="var(--color-success)">
          {finished
            .slice()
            .sort((a, b) => a.time_rank - b.time_rank)
            .map((s) => s.number)
            .join(" · ")}
        </text>
      )}
    </svg>
  );
}

function TimeCard({ board }: { board: FestivalBoard }) {
  const rows = [...board.standings].sort(
    (a, b) => a.time_rank - b.time_rank || a.number - b.number,
  );
  return (
    <div className="fest-card">
      <h2>По времени</h2>
      <div className="fest-rows">
        {rows.map((s) => (
          <div className="fest-row" key={s.participant_id}>
            <span className="fest-rank">{s.time_rank}</span>
            <span className="fest-num" style={{ color: teamColor(s.team) }}>
              {s.number}
            </span>
            <span className="fest-name">{s.name}</span>
            {s.finished ? (
              <span className="fest-value fest-value--done">
                {formatClock(s.finish_seconds ?? 0)}
              </span>
            ) : (
              <span className="fest-value fest-value--muted">
                {s.lap} круг · {s.stations_done}/{board.race.stations}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PointsCard({ board }: { board: FestivalBoard }) {
  const rows = [...board.standings].sort(
    (a, b) => a.points_rank - b.points_rank || a.number - b.number,
  );
  return (
    <div className="fest-card">
      <h2>По баллам</h2>
      <div className="fest-rows">
        {rows.map((s) => (
          <div className="fest-row" key={s.participant_id}>
            <span className="fest-rank">{s.points_rank}</span>
            <span className="fest-num" style={{ color: teamColor(s.team) }}>
              {s.number}
            </span>
            <span className="fest-name">{s.name}</span>
            <span className="fest-value">{s.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScreenPage() {
  const { slug = "" } = useParams();
  const [board, setBoard] = useState<FestivalBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Часы гонки идут по серверному времени: ноутбук на сцене может отставать.
  const now = useNow(250);
  const [skew, setSkew] = useState(0);

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

  const elapsed = useMemo(() => {
    if (!board?.race.started_at || now === 0) return null;
    const end = board.race.finished_at
      ? new Date(board.race.finished_at).getTime()
      : now - skew;
    return (end - new Date(board.race.started_at).getTime()) / 1000;
  }, [board, now, skew]);

  if (error) {
    return <div className="fest-empty">{error}</div>;
  }
  if (!board) {
    return <div className="fest-empty">Загрузка…</div>;
  }

  return (
    <div className="fest">
      <div className="fest-head">
        <div>
          <div className="fest-title">{board.race.title}</div>
          <div className="fest-status">
            {board.race.finished_at
              ? "гонка завершена"
              : board.race.started_at
                ? `${board.standings.length} участников на дистанции`
                : "старт вот-вот"}
          </div>
        </div>
        <div className="fest-clock">
          {elapsed === null ? "—:—" : formatClock(elapsed)}
        </div>
      </div>
      <div className="fest-body">
        <div className="fest-track">
          <Track board={board} />
        </div>
        <div className="fest-side">
          <TimeCard board={board} />
          <PointsCard board={board} />
        </div>
      </div>
    </div>
  );
}
