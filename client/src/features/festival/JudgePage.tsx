import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../shared/api/client";
import {
  clearJudgeToken,
  festivalApi,
  getJudgeToken,
  setJudgeToken,
} from "./festival-api";
import {
  formatClock,
  hexToHsl,
  hslToHex,
  NUMBER_PALETTE,
  numberColor,
} from "./format";
import { HoldButton } from "./HoldButton";
import { useNow } from "./use-now";
import type { FestivalJudgeView, FestivalStanding } from "./types";

// Экран судьи. Судья ходит вместе со своим участником, поэтому выбирать
// некого: на экране один номер, одна кнопка следующей точки и, после закрытия
// круга, ввод баллов. Всё остальное — положение своего номера и лента отметок.

// До старта экран опрашивается чаще: судья должен увидеть боевой режим сразу,
// а не через пять секунд после отмашки.
const POLL_WAITING_MS = 3000;
const POLL_RUNNING_MS = 5000;

// «Сколько точек пройдено» — общая мера дистанции: рубежи плюс закрытия кругов.
function marks(s: FestivalStanding, stations: number): number {
  return (s.lap - 1) * (stations + 1) + s.stations_done;
}

function PinForm({ onDone }: { onDone: (view: FestivalJudgeView) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { token, view } = await festivalApi.judge.login(pin);
      setJudgeToken(token);
      onDone(view);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось войти");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Судья фестиваля</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Введите код своего участника.
        </p>
      </div>
      <div className="text-center font-mono text-4xl tracking-[0.4em]">
        {pin.padEnd(4, "·")}
      </div>
      {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"].map((key) => (
          <button
            key={key}
            disabled={busy}
            onClick={() => {
              if (key === "←") setPin((p) => p.slice(0, -1));
              else if (key === "OK") void submit();
              else setPin((p) => (p.length >= 8 ? p : p + key));
            }}
            className={
              "py-5 text-2xl " +
              (key === "OK"
                ? "bg-[var(--color-brand)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text)]")
            }
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

// Где мой номер относительно остальных. По времени сравниваем пройденной
// дистанцией, пока не все финишировали: секунды между бегущими сравнивать не с
// чем — старт общий, а отметки идут в разное время.
function PlacePanel({ view }: { view: FestivalJudgeView }) {
  const { standing, standings, race } = view;
  const leader = standings.find((s) => s.time_rank === 1);
  const pointsLeader = standings.find((s) => s.points_rank === 1);

  let timeGap = "вы идёте первым";
  if (leader && leader.participant_id !== standing.participant_id) {
    if (standing.finished && leader.finished) {
      const gap = (standing.total_seconds ?? 0) - (leader.total_seconds ?? 0);
      timeGap = `отставание ${formatClock(gap)} от №${leader.number}`;
    } else {
      const gap = marks(leader, race.stations) - marks(standing, race.stations);
      timeGap =
        gap <= 0
          ? `вровень с лидером №${leader.number}`
          : `на ${gap} ${gap === 1 ? "точку" : gap < 5 ? "точки" : "точек"} позади №${leader.number}`;
    }
  }

  const pointsGap =
    pointsLeader && pointsLeader.participant_id !== standing.participant_id
      ? `до №${pointsLeader.number} ${pointsLeader.points - standing.points} б.`
      : "лучший результат";

  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="text-xs text-[var(--color-text-muted)]">По времени</div>
        <div className="text-2xl font-semibold">
          {standing.time_rank}
          <span className="text-base font-normal text-[var(--color-text-muted)]">
            {" "}
            из {standings.length}
          </span>
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">{timeGap}</div>
      </div>
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="text-xs text-[var(--color-text-muted)]">По баллам</div>
        <div className="text-2xl font-semibold">
          {standing.points_rank}
          <span className="text-base font-normal text-[var(--color-text-muted)]">
            {" "}
            · {standing.points} б.
          </span>
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">{pointsGap}</div>
      </div>
    </div>
  );
}

// Ползунок канала цвета. Свой бегунок вместо системного: у нативного ручка
// на разных телефонах разного размера и его не покрасишь, а тут вся полоса —
// это сам цвет, и видно, что выбираешь, ещё до нажатия.
function ColorSlider({
  label,
  value,
  max,
  track,
  onPick,
}: {
  label: string;
  value: number;
  max: number;
  track: string;
  onPick: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span
        className="relative mt-1 block h-9 rounded border border-[var(--color-border)]"
        style={{ background: track }}
      >
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onPick(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-9 [&::-moz-range-thumb]:w-9 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:h-9 [&::-webkit-slider-thumb]:w-9 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-transparent"
        />
        <span
          className="pointer-events-none absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full border border-black/50 bg-white"
          style={{ left: `calc(${(value / max) * 100}% + ${9 - (value / max) * 18}px)` }}
        />
      </span>
    </label>
  );
}

// Цвет своего номера. На экране показа рядом идут команды с близкими
// оттенками, и найти в едущем списке свой номер проще по цвету, выбранному на
// месте. Цвет любой: ползунки тона, насыщенности и яркости, код #RRGGBB и
// системная пипетка; палитра сверху — просто быстрые нажатия. Судья красит
// только своего участника, «по команде» возвращает цвет из названия команды.
function ColorPanel({
  view,
  onView,
}: {
  view: FestivalJudgeView;
  onView: (v: FestivalJudgeView) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // Пока ползунок ведут пальцем, показываем выбранное, а не то, что успел
  // вернуть опрос: иначе цвет прыгал бы назад между кадрами.
  const [draft, setDraft] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const send = useRef<number | null>(null);

  const saved = numberColor(view.participant.color, view.participant.team);
  const shown = draft ?? saved;
  const { h, s, l } = hexToHsl(shown);

  useEffect(
    () => () => {
      if (send.current) clearTimeout(send.current);
    },
    [],
  );

  async function apply(color: string | null): Promise<void> {
    setError(null);
    try {
      onView(await festivalApi.judge.setColor(color));
      setDraft(null);
      setTyped(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Цвет не сохранился");
    }
  }

  // Ползунок даёт десятки значений в секунду — на сервер уходит одно, через
  // четверть секунды после того, как палец остановился.
  function pick(color: string): void {
    setDraft(color);
    setTyped(null);
    if (send.current) clearTimeout(send.current);
    send.current = window.setTimeout(() => void apply(color), 250);
  }

  // Код принимаем и с решёткой, и без неё — набирают по-разному.
  function submitTyped(): void {
    const value = (typed ?? "").trim().replace(/^#?/, "#");
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
      setError("Код цвета — шесть знаков, вида #RRGGBB");
      return;
    }
    void apply(value.toLowerCase());
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">Цвет номера</span>
        <button
          disabled={view.participant.color === null}
          onClick={() => void apply(null)}
          className="text-xs text-[var(--color-text-muted)] underline disabled:opacity-40"
        >
          по команде
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Кружок — и предпросмотр фишки, и вызов системной пипетки. */}
        <label
          className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full text-lg font-bold text-black"
          style={{ background: shown }}
        >
          {view.participant.number}
          <input
            type="color"
            value={shown}
            onChange={(e) => pick(e.target.value)}
            className="sr-only"
          />
        </label>
        <input
          value={typed ?? shown}
          spellCheck={false}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
          }}
          onBlur={() => typed !== null && submitTyped()}
          onKeyDown={(e) => e.key === "Enter" && submitTyped()}
          placeholder="#RRGGBB"
          className="w-32 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-3 font-mono text-base text-[var(--color-text)]"
        />
      </div>

      <div className="mt-3 grid gap-2">
        <ColorSlider
          label="Тон"
          value={h}
          max={359}
          track="linear-gradient(90deg,#f00,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00)"
          onPick={(v) => pick(hslToHex(v, s === 0 ? 80 : s, l))}
        />
        <ColorSlider
          label="Насыщенность"
          value={s}
          max={100}
          track={`linear-gradient(90deg, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})`}
          onPick={(v) => pick(hslToHex(h, v, l))}
        />
        <ColorSlider
          label="Яркость"
          value={l}
          max={100}
          track={`linear-gradient(90deg,#000, ${hslToHex(h, s, 50)}, #fff)`}
          onPick={(v) => pick(hslToHex(h, s, v))}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {NUMBER_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => void apply(c)}
            aria-label={`цвет ${c}`}
            style={{ background: c }}
            className={
              "h-9 w-9 rounded-full " +
              (c === shown.toLowerCase()
                ? "ring-2 ring-[var(--color-text)] ring-offset-2 ring-offset-[var(--color-surface)]"
                : "")
            }
          />
        ))}
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        Так номер и рамка строки выглядят на большом экране.
      </p>
      {error && <div className="mt-2 text-sm text-[var(--color-danger)]">{error}</div>}
    </div>
  );
}

function PointsForm({
  view,
  onView,
}: {
  view: FestivalJudgeView;
  onView: (v: FestivalJudgeView) => void;
}) {
  const [value, setValue] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (value === 0) return;
    setBusy(true);
    setError(null);
    try {
      onView(await festivalApi.judge.addPoints(value));
      setValue(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не записалось");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold">Баллы за круг {view.score_lap}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          всего у номера: {view.total_points}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setValue((v) => v - 1)}
          className="w-14 bg-[var(--color-elevated)] py-3 text-xl"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Math.trunc(Number(e.target.value)) || 0)}
          className="w-24 border border-[var(--color-border)] bg-[var(--color-bg)] py-3 text-center text-xl text-[var(--color-text)]"
        />
        <button
          onClick={() => setValue((v) => v + 1)}
          className="w-14 bg-[var(--color-elevated)] py-3 text-xl"
        >
          +
        </button>
        <button
          disabled={busy || value === 0}
          onClick={submit}
          className="flex-1 bg-[var(--color-brand)] py-3 text-base text-white disabled:opacity-60"
        >
          Записать
        </button>
      </div>
      {error && <div className="mt-2 text-sm text-[var(--color-danger)]">{error}</div>}
    </div>
  );
}

export function JudgePage() {
  const [view, setView] = useState<FestivalJudgeView | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skew, setSkew] = useState(0);
  const now = useNow(500);

  const load = useCallback(async (): Promise<void> => {
    try {
      const next = await festivalApi.judge.me();
      setSkew(Date.now() - new Date(next.server_time).getTime());
      setView(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearJudgeToken();
        setView(null);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!getJudgeToken()) {
      setReady(true);
      return;
    }
    void load();
  }, [load]);

  // Догоняем чужие изменения: отмашку старта и правки админа, который мог снять
  // ошибочную отметку, пока судья бежит.
  const started = !!view?.race.started_at;
  useEffect(() => {
    if (!view) return;
    const id = setInterval(
      () => void load(),
      started ? POLL_RUNNING_MS : POLL_WAITING_MS,
    );
    return () => clearInterval(id);
  }, [view, started, load]);

  if (!ready) {
    return <div className="p-6 text-[var(--color-text-muted)]">Загрузка…</div>;
  }
  if (!view) {
    return <PinForm onDone={setView} />;
  }

  const { race, participant, next } = view;
  const ownColor = numberColor(participant.color, participant.team);
  const nextLabel = !next
    ? null
    : next.kind === "start"
      ? "Старт"
      : next.kind === "lap"
        ? `Закрыть круг ${next.lap}`
        : `Рубеж ${next.station_idx}`;
  const nextHint = !next
    ? ""
    : next.kind === "start"
      ? "включить отсчёт участнику"
      : next.kind === "lap"
        ? "участник прошёл все рубежи круга"
        : (view.stations.find((s) => s.idx === next.station_idx)?.name ?? "");

  // Секундомер личный: он идёт от старта, который включил этот судья, а не от
  // отмашки гонки.
  const own = view.standing;
  const elapsed = own.finished
    ? own.clean_seconds
    : own.start_at && now > 0
      ? (now - skew - new Date(own.start_at).getTime()) / 1000
      : null;

  async function act(action: () => Promise<FestivalJudgeView>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setView(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось");
      void load();
    } finally {
      setBusy(false);
    }
  }

  // До отмашки отмечать нечего: показываем карточку номера и ждём. Экран
  // переключится сам, опрос идёт каждые три секунды.
  if (!race.started_at) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4 text-center">
        <div className="text-sm text-[var(--color-text-muted)]">{race.title}</div>
        <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="text-6xl font-semibold" style={{ color: ownColor }}>
            №{participant.number}
          </div>
          <div className="mt-2 text-xl">{participant.name}</div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {participant.team ?? "без команды"}
          </div>
        </div>
        <div className="text-2xl font-semibold">Ждём старта</div>
        <div className="text-sm text-[var(--color-text-muted)]">
          Когда вызовут ваш номер — нажмите «Старт». С этого момента пойдёт
          личное время участника.
        </div>
        <ColorPanel view={view} onView={setView} />
        <div className="text-xs text-[var(--color-text-muted)]">
          судья {view.judge.name ?? "—"} ·{" "}
          <button
            onClick={() => {
              clearJudgeToken();
              setView(null);
            }}
            className="underline"
          >
            выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 p-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xl font-semibold">
            <span style={{ color: ownColor }}>№{participant.number}</span>{" "}
            {participant.name}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {participant.team ?? "без команды"} · судья {view.judge.name ?? "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">
            {elapsed === null ? "на старте" : formatClock(elapsed)}
          </div>
          {own.penalties > 0 && (
            <div className="text-xs text-[var(--color-warning)]">
              +{own.penalty_seconds} с штрафа
            </div>
          )}
          <button
            onClick={() => {
              clearJudgeToken();
              setView(null);
            }}
            className="text-xs text-[var(--color-text-muted)] underline"
          >
            выйти
          </button>
        </div>
      </header>

      <PlacePanel view={view} />

      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
        {!own.started
          ? "Отсчёт не начат — нажмите «Старт», когда участник уходит на дистанцию."
          : `Круг ${next ? next.lap : race.laps} из ${race.laps} · пройдено рубежей: ${
              next && next.kind === "station" ? (next.station_idx ?? 1) - 1 : race.stations
            } из ${race.stations}`}
      </div>

      {next ? (
        <HoldButton
          label={nextLabel ?? ""}
          hint={busy ? "записываю…" : `${nextHint} · держите кнопку`}
          disabled={busy || !!race.finished_at}
          onFire={() => void act(() => festivalApi.judge.mark(next))}
        />
      ) : (
        <div className="bg-[var(--color-success)] px-4 py-10 text-center text-2xl font-semibold text-black">
          Финиш!
          {own.total_seconds !== null && (
            <div className="mt-1 text-base font-normal">
              {formatClock(own.total_seconds)} · {own.time_rank} место
              {own.penalties > 0 &&
                ` (чисто ${formatClock(own.clean_seconds ?? 0)} + ${own.penalties} шт.)`}
            </div>
          )}
        </div>
      )}

      {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}

      {own.started && (
        <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Штрафы</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {own.penalties} шт. · +{own.penalty_seconds} с к времени
            </span>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy || !!race.finished_at}
              onClick={() => void act(() => festivalApi.judge.addPenalty())}
              className="flex-1 bg-[var(--color-warning)] py-3 text-base font-semibold text-black disabled:opacity-50"
            >
              + Штраф (+{race.penalty_seconds} с)
            </button>
            <button
              disabled={busy || own.penalties === 0}
              onClick={() => void act(() => festivalApi.judge.undoPenalty())}
              className="bg-[var(--color-elevated)] px-4 py-3 text-sm text-[var(--color-text-muted)] disabled:opacity-40"
            >
              снять
            </button>
          </div>
        </div>
      )}

      {view.score_lap !== null && <PointsForm view={view} onView={setView} />}

      <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
          <span className="text-sm font-semibold">Отмечено</span>
          <button
            disabled={busy || view.events.length === 0}
            onClick={() => void act(() => festivalApi.judge.undo())}
            className="text-sm text-[var(--color-danger)] disabled:opacity-40"
          >
            Отменить последнюю
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto text-sm">
          {view.events
            .map((e, i) => {
              // Сплит: сколько прошло с предыдущей точки, у первой — от старта.
              const prev = i === 0 ? null : (view.events[i - 1]?.at ?? null);
              const split = prev
                ? (new Date(e.at).getTime() - new Date(prev).getTime()) / 1000
                : null;
              return { event: e, split };
            })
            .reverse()
            .map(({ event, split }) => (
              <div
                key={event.id}
                className="flex justify-between border-b border-[var(--color-border)] px-3 py-1.5"
              >
                <span>
                  {event.kind === "start"
                    ? "старт"
                    : event.kind === "lap"
                      ? `круг ${event.lap} закрыт`
                      : `рубеж ${event.station_idx} (круг ${event.lap})`}
                </span>
                <span className="tabular-nums text-[var(--color-text-muted)]">
                  {split === null ? "—" : `+${formatClock(split)}`}
                </span>
              </div>
            ))}
          {view.events.length === 0 && (
            <div className="px-3 py-2 text-[var(--color-text-muted)]">Пока ничего.</div>
          )}
        </div>
      </div>

      <ColorPanel view={view} onView={setView} />

      {view.points.length > 0 && (
        <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-border)] px-3 py-2 text-sm font-semibold">
            Баллы
          </div>
          <div className="text-sm">
            {[...view.points].reverse().map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-1.5"
              >
                <span>
                  круг {p.lap} ·{" "}
                  <b className={p.points < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}>
                    {p.points > 0 ? `+${p.points}` : p.points}
                  </b>
                </span>
                <button
                  disabled={busy}
                  onClick={() => void act(() => festivalApi.judge.deletePoint(p.id))}
                  className="text-xs text-[var(--color-danger)]"
                >
                  снять
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
