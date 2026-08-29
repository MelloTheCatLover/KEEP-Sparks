import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
const CONFETTI = 16;
// Сколько держится подсветка у того, кто только что обошёл соседей.
const FLASH_MS = 1600;
// Ниже этой ширины — телефон: одна колонка, страница прокручивается.
const NARROW = "(max-width: 900px)";
// Имена на телефоне не сокращаются, поэтому строки разной высоты: длинное имя
// переносится на вторую строку. Отступы вокруг списка — в пикселях.
const MOBILE_GAP = 8;
const MOBILE_TOP = 8;
const MOBILE_BOTTOM = 24;
// Высота строки до первого замера (первый кадр) — примерно одна строка имени.
const MOBILE_ROW_GUESS = 96;

// Порядок: первым тот, у кого больше баллов; при равенстве выше тот, кто дальше
// по дистанции и быстрее.
function sortRows(standings: FestivalStanding[]): FestivalStanding[] {
  return [...standings].sort(
    (a, b) =>
      b.points - a.points || a.time_rank - b.time_rank || a.number - b.number,
  );
}

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

// Телефон или проектор: от этого зависит вся раскладка таблицы.
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const sync = (): void => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return narrow;
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
  // ?calm=1 — выключить движение вручную, если экран поедет на слабой машине.
  const calm = new URLSearchParams(window.location.search).has("calm");
  const [board, setBoard] = useState<FestivalBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Часы идут по серверному времени: ноутбук на сцене может отставать.
  const [skew, setSkew] = useState(0);
  // Кто на последнем обновлении поднялся в таблице — их строки подсвечиваются.
  const [climbed, setClimbed] = useState<number[]>([]);
  const places = useRef(new Map<number, number>());
  const flashTimer = useRef<number | null>(null);
  const now = useNow(250);
  const narrow = useNarrow();
  useFonts();

  // Замеры строк для телефона: сдвиг «место × константа» не годится, когда
  // высота зависит от длины имени, — офсеты считаем по фактическим высотам.
  const rowEls = useRef(new Map<number, HTMLDivElement>());
  const [heights, setHeights] = useState<Record<number, number>>({});

  // Колбэк один на все строки — участник берётся из data-атрибута узла, иначе
  // на каждом опросе React отцеплял бы и прицеплял ссылки заново.
  const bindRow = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const id = Number(el.dataset.pid);
    rowEls.current.set(id, el);
    return () => {
      rowEls.current.delete(id);
    };
  }, []);

  const measure = useCallback((): void => {
    setHeights((prev) => {
      const next: Record<number, number> = {};
      let same = Object.keys(prev).length === rowEls.current.size;
      rowEls.current.forEach((el, id) => {
        next[id] = el.offsetHeight;
        if (prev[id] !== next[id]) same = false;
      });
      return same ? prev : next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    let loaded = false;
    async function tick(): Promise<void> {
      try {
        const next = await festivalApi.board(slug);
        if (!active) return;
        setSkew(Date.now() - new Date(next.server_time).getTime());
        loaded = true;

        // Сравниваем новый порядок с предыдущим: кто поднялся — подсвечиваем.
        const order = sortRows(next.standings);
        const up: number[] = [];
        const fresh = new Map<number, number>();
        order.forEach((s, i) => {
          const was = places.current.get(s.participant_id);
          fresh.set(s.participant_id, i);
          if (was !== undefined && i < was) up.push(s.participant_id);
        });
        places.current = fresh;
        if (up.length > 0) {
          setClimbed(up);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(() => setClimbed([]), FLASH_MS);
        }

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
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [slug]);

  // Первый замер — до того, как браузер покажет кадр, чтобы список не дёрнулся.
  useLayoutEffect(() => {
    if (narrow) measure();
  }, [narrow, board, measure]);

  // Шрифт догрузился, телефон повернули — высоты поменялись, пересчитываем.
  useEffect(() => {
    if (!narrow) return;
    const ro = new ResizeObserver(() => measure());
    rowEls.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [narrow, board?.standings.length, measure]);

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
  const rows = sortRows(board.standings);
  // Две колонки: первая половина слева, вторая справа.
  const half = Math.ceil(rows.length / 2);
  // Порядок в разметке постоянный — по номеру. Место задаётся сдвигом, поэтому
  // React не переставляет узлы и переезд едет анимацией, а не рывком.
  const place = new Map(rows.map((s, i) => [s.participant_id, i]));
  const dom = [...board.standings].sort((a, b) => a.number - b.number);

  // Телефон: сдвиг строки — сумма высот всех, кто выше неё, плюс зазоры.
  const offsets = new Map<number, number>();
  let stack = 0;
  for (const s of rows) {
    offsets.set(s.participant_id, stack);
    stack += (heights[s.participant_id] ?? MOBILE_ROW_GUESS) + MOBILE_GAP;
  }
  const listHeight = MOBILE_TOP + Math.max(0, stack - MOBILE_GAP) + MOBILE_BOTTOM;

  return (
    <div className={"fest" + (calm ? " fest--calm" : "")}>
      <div className="fest-beams" aria-hidden>
        {[18, 50, 82].map((left, i) => (
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

      <div
        className="fest-table"
        style={
          narrow
            ? { height: listHeight }
            : ({ "--rows": half } as CSSProperties)
        }
      >
        {dom.map((s) => {
          const i = place.get(s.participant_id) ?? 0;
          const seconds = ownSeconds(s, now, skew);
          const color = numberColor(s.color, s.team);
          const passed = (s.lap - 1) * race.stations + s.stations_done;
          const col = i < half ? 0 : 1;
          const row = i < half ? i : i - half;
          return (
            <div
              key={s.participant_id}
              ref={bindRow}
              data-pid={s.participant_id}
              className={
                "fest-row" +
                (s.finished ? " fest-row--done" : "") +
                (s.started ? "" : " fest-row--idle") +
                (climbed.includes(s.participant_id) ? " fest-row--up" : "")
              }
              // Рамка — цветом номера из палитры. Сдвиг задаётся строкой, а не
              // переменной: значения в var() браузер между кадрами не
              // интерполирует, и переезд получался рывком.
              style={{
                borderColor: color,
                // На телефоне колонка одна, шаг — в пикселях по замеру: строки
                // разной высоты, потому что имена не сокращаются.
                transform: narrow
                  ? `translate(0, ${offsets.get(s.participant_id) ?? 0}px)`
                  : `translate(calc(${col} * (100% + 2vw)), calc(${row} * (100% + 1vh)))`,
                zIndex: climbed.includes(s.participant_id) ? 2 : 1,
              }}
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
