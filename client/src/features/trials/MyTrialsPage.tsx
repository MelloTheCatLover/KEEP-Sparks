import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "@fontsource/oswald/300.css";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/700.css";
import "@fontsource/pt-serif/400.css";
import "@fontsource/pt-serif/400-italic.css";
import "@fontsource/pt-serif/700.css";
import "@fontsource/pt-mono/400.css";
import "./park.css";
import { trialsApi } from "./trials-api";
import type { MyTrials, TrialBoardRow } from "./types";

// Страница смены с испытаниями — «Разбитый парк» (134). Своя тема и шапка,
// вне общей раскладки ребёнка: по claude/134_дизайн_искры/DESIGN.md интерфейс
// выглядит как вещи парка — табло, билет, счётчик, кассовая книга, газета.
//
// Шрифты и тема подгружаются только с этой страницей (маршрут ленивый).

// После какого места на табло черта финала.
const FINAL_CUT = 10;

function pts(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

// Номер участника — всегда трёхзначный: № 007.
function no(n: number | null): string {
  return n === null ? "—" : String(n).padStart(3, "0");
}

function delta(n: number): { text: string; cls: string } {
  if (n > 0) return { text: `+${pts(n)}`, cls: "delta-up" };
  if (n < 0) return { text: `−${pts(-n)}`, cls: "delta-down" };
  return { text: "0", cls: "" };
}

export function MyTrialsPage() {
  // undefined — грузится, null — у смены нет открытых испытаний.
  const [data, setData] = useState<MyTrials | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    trialsApi
      .mine()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error || data === undefined || data === null) {
    return (
      <div className="park">
        <div className="wrap closed">
          {error ? (
            <>
              <p className="sign">Не работает</p>
              <p className="empty">Аттракцион временно не работает.</p>
            </>
          ) : data === undefined ? (
            <span className="label">Открываем кассу…</span>
          ) : (
            <p className="empty">Здесь пока никого.</p>
          )}
          {data !== undefined && (
            <Link to="/" className="label">
              Вернуться в Искры
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="park">
      <div className="wrap">
        <header className="topbar">
          <Link to="/" className="topbar__brand">
            KEEP · Искры · <b>{data.shift_id}</b>
          </Link>
          <nav className="nav">
            <a href="#board">Табло</a>
            <a href="#ticket">Билет</a>
            <a href="#log">Кассовая книга</a>
            <a href="#rules">Правила</a>
            <Link to="/">В Искры</Link>
          </nav>
        </header>

        <section className="hero">
          <span className="sign__over">Хоррор-реалити-шоу</span>
          <h1 className="sign">{data.name ?? "Разбитый парк"}</h1>
          <span className="label">
            День {data.last_day} · посетителей {data.participants}
          </span>
        </section>

        <section className="grid">
          <div id="board">
            <div className="row row--between">
              <h2>Табло</h2>
              <span className="label">после дня {data.last_day}</span>
            </div>
            <Board rows={data.board} />
          </div>

          <div className="stack stack--aside" id="ticket">
            <div>
              <span className="label">Ваш билет</span>
              <article className="ticket">
                <div className="ticket__body">
                  <div>
                    <p className="ticket__name">
                      {data.me.f_name} {data.me.l_name}
                    </p>
                    <p className="ticket__meta">
                      Посетитель · место {data.place} из {data.participants}
                    </p>
                  </div>
                </div>
                <div className="ticket__stub">
                  <span className="label">№</span>
                  <span className="ticket__no">{no(data.me.number)}</span>
                </div>
              </article>
            </div>

            <div>
              <span className="label">На руках</span>
              <Counter value={data.total} />
            </div>

            <div id="log">
              <span className="label">Кассовая книга</span>
              <CashBook data={data} />
            </div>
          </div>
        </section>

        <section className="grid" id="rules">
          <Rules data={data} />
          <div>
            <h3>По дням</h3>
            <div className="board-wrap">
              <table className="board">
                <thead>
                  <tr>
                    <th>День</th>
                    <th className="hide-sm">Испытаний</th>
                    <th className="num">Баллы</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((d) => (
                    <tr key={d.day}>
                      <td className="pos">{d.day}</td>
                      <td className="hide-sm">{d.trials.length}</td>
                      <td className="num">{pts(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Табло смены: плотная таблица на всю ширину, своя строка подсвечена, черта
// финала после 10-го места.
function Board({ rows }: { rows: TrialBoardRow[] }) {
  if (rows.length === 0) return <div className="empty">Здесь пока никого.</div>;
  return (
    <div className="board-wrap">
      <table className="board">
        <thead>
          <tr>
            <th>#</th>
            <th>Посетитель</th>
            <th className="num">Δ</th>
            <th className="num">Баллы</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const next = rows[i + 1];
            const cut =
              r.place <= FINAL_CUT && next !== undefined && next.place > FINAL_CUT;
            const d = delta(r.delta);
            return (
              <tr
                key={`${r.number ?? "x"}-${i}`}
                className={[cut && "cut", r.is_me && "me"]
                  .filter(Boolean)
                  .join(" ")}
              >
                <td className="pos">{r.place}</td>
                <td>
                  {r.name} <span className="label">№ {no(r.number)}</span>
                </td>
                <td className={`num ${d.cls}`}>{d.text}</td>
                <td className="num">{pts(r.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Механический счётчик у кассы: не меньше трёх барабанов.
function Counter({ value }: { value: number }) {
  const text =
    Number.isInteger(value) && value >= 0
      ? String(value).padStart(3, "0")
      : pts(value);
  return (
    <div className={`counter num ${value < 0 ? "counter--neg" : ""}`}>
      {[...text].map((ch, i) => (
        <span key={i}>{ch}</span>
      ))}
    </div>
  );
}

// Кассовая книга: каждое открытое испытание строкой, свежие сверху.
function CashBook({ data }: { data: MyTrials }) {
  const lines = [...data.days]
    .reverse()
    .flatMap((d) => [...d.trials].reverse().map((t) => ({ day: d.day, t })));
  if (lines.length === 0) return <div className="empty">Здесь пока никого.</div>;
  return (
    <ul className="log">
      {lines.map(({ day, t }) => {
        const d = t.points === null ? null : delta(t.points);
        return (
          <li key={t.id}>
            <time>Д{day}</time>
            <span>
              {t.title}
              <br />
              <span className="log__place">
                {t.place === null
                  ? "не участвовал(а)"
                  : `${t.place} место из ${t.scored}`}
              </span>
            </span>
            <span className={`num ${d?.cls ?? ""}`}>{d ? d.text : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Правила игры — газетной вырезкой, голосом дирекции парка.
function Rules({ data }: { data: MyTrials }) {
  return (
    <article className="clipping">
      <div className="clipping__mast">Вечерний вестник</div>
      <div className="clipping__date">
        <span>№ {data.shift_id}</span>
        <span>день {data.last_day}</span>
      </div>
      <h3>Правила кассы</h3>
      <p>
        Каждый день в парке проходят испытания. За каждое касса выдаёт
        посетителю баллы — они появляются на табло, как только дирекция
        откроет результаты.
      </p>
      <p>
        Место на табло считается по сумме за все дни. Равные суммы делят
        место. В каждом испытании у посетителя своё место — среди тех, кто в
        нём участвовал. Графа «Δ» на табло — сколько принёс последний день.
      </p>
      <p>Красная черта на табло отделяет первую десятку.</p>
      <p className="clipping__by">Дирекция</p>
    </article>
  );
}
