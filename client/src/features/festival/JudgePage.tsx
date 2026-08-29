import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import {
  clearJudgeToken,
  festivalApi,
  getJudgeToken,
  setJudgeToken,
} from "./festival-api";
import { formatClock } from "./format";
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
          <div className="text-6xl font-semibold">№{participant.number}</div>
          <div className="mt-2 text-xl">{participant.name}</div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {participant.team ?? "без команды"}
          </div>
        </div>
        <div className="text-2xl font-semibold">Ждём старта</div>
        <div className="text-sm text-[var(--color-text-muted)]">
          Экран сам включится, когда гонку запустят. Держите телефон разблокированным.
        </div>
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
            №{participant.number} {participant.name}
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
