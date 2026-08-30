import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { festivalApi } from "./festival-api";
import { formatClock, numberColor } from "./format";
import type { FestivalBoard, FestivalStanding } from "./types";
import "./festival-screen.css";

// Финальные итоги фестиваля. Открываются кнопкой с экрана показа — и только
// после того, как админ объявил их: до этого места ещё меняются, судьи вносят
// баллы, а ошибочные отметки снимаются.
//
// Итог — сумма двух мест: за время и за баллы. Поэтому на карточке видно все
// три числа, а не одно: иначе «почему я третий» приходится объяснять со сцены.

const POLL_MS = 5000;

// Первая тройка выделяется цветом — её и ищут глазами.
const PODIUM = ["#ffb400", "#d7e3f5", "#e08a3c"];

function byOverall(rows: FestivalStanding[]): FestivalStanding[] {
  return [...rows].sort(
    (a, b) => a.overall_rank - b.overall_rank || a.time_rank - b.time_rank,
  );
}

export function ResultsPage() {
  const { slug = "" } = useParams();
  const [board, setBoard] = useState<FestivalBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function tick(): Promise<void> {
      try {
        const next = await festivalApi.board(slug);
        if (active) setBoard(next);
      } catch {
        if (active) setError("Гонка не найдена");
      }
    }
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [slug]);

  if (error) return <div className="fest-empty">{error}</div>;
  if (!board) return <div className="fest-empty">Загрузка…</div>;

  const { race } = board;
  if (!race.results_published) {
    return (
      <div className="fest fest--results">
        <header className="fest-head">
          <h1 className="fest-title">{race.title}</h1>
          <div className="fest-rule" />
        </header>
        <div className="fest-vote-done">
          <div className="fest-vote-lead">Итоги ещё не объявлены</div>
          <div className="fest-vote-sub">
            Страницу можно не закрывать — она обновится сама.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fest fest--results">
      <header className="fest-head">
        <h1 className="fest-title">Итоги · {race.title}</h1>
        <div className="fest-rule" />
      </header>

      <div className="fest-res">
        {byOverall(board.standings).map((s) => {
          const color = numberColor(s.color, s.team);
          const medal = s.overall_rank <= 3 ? PODIUM[s.overall_rank - 1] : null;
          return (
            <div
              key={s.participant_id}
              className={"fest-res-row" + (medal ? " fest-res-row--top" : "")}
              style={{ borderColor: medal ?? color }}
            >
              <div
                className="fest-res-place"
                style={medal ? { color: medal } : undefined}
              >
                {s.overall_rank}
              </div>
              <div className="fest-res-who">
                <div className="fest-res-name">
                  <span className="fest-res-num" style={{ background: color }}>
                    {s.number}
                  </span>
                  {s.name}
                </div>
                <div className="fest-res-team">{s.team ?? "—"}</div>
              </div>
              <div className="fest-res-cells">
                <div className="fest-res-cell">
                  <div className="fest-res-cell-label">Время</div>
                  <div className="fest-res-cell-rank">{s.time_rank} место</div>
                  <div className="fest-res-cell-sub">
                    {s.total_seconds === null ? "—" : formatClock(s.total_seconds)}
                    {s.penalties > 0 && ` (+${s.penalty_seconds}с)`}
                  </div>
                </div>
                <div className="fest-res-cell">
                  <div className="fest-res-cell-label">Баллы</div>
                  <div className="fest-res-cell-rank">{s.points_rank} место</div>
                  <div className="fest-res-cell-sub">{s.points} б.</div>
                </div>
                <div className="fest-res-cell fest-res-cell--total">
                  <div className="fest-res-cell-label">Итог</div>
                  <div className="fest-res-cell-rank">{s.overall_rank} место</div>
                  <div className="fest-res-cell-sub">
                    {s.time_rank} + {s.points_rank}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
