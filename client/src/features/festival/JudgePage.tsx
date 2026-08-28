import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import {
  clearJudgeToken,
  festivalApi,
  getJudgeToken,
  setJudgeToken,
} from "./festival-api";
import { formatClock } from "./format";
import type { FestivalJudgeView } from "./types";

// Экран судьи. Судья ходит вместе со своим участником, поэтому выбирать
// некого: на экране один номер, одна крупная кнопка «следующая точка» и, после
// закрытия круга, ввод баллов. Всё остальное — лента отметок с откатом.

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

function PointsForm({
  view,
  onView,
}: {
  view: FestivalJudgeView;
  onView: (v: FestivalJudgeView) => void;
}) {
  const [value, setValue] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (value === 0) return;
    setBusy(true);
    setError(null);
    try {
      onView(await festivalApi.judge.addPoints(value, note.trim() || null));
      setValue(1);
      setNote("");
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
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="За что (необязательно)"
        className="mt-2 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-sm text-[var(--color-text)]"
      />
      {error && <div className="mt-2 text-sm text-[var(--color-danger)]">{error}</div>}
    </div>
  );
}

export function JudgePage() {
  const [view, setView] = useState<FestivalJudgeView | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setView(await festivalApi.judge.me());
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

  // Догоняем правки админа: он мог снять ошибочную отметку, пока судья бежит.
  useEffect(() => {
    if (!view) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [view, load]);

  if (!ready) {
    return <div className="p-6 text-[var(--color-text-muted)]">Загрузка…</div>;
  }
  if (!view) {
    return <PinForm onDone={setView} />;
  }

  const { race, participant, next } = view;
  const nextLabel = !next
    ? null
    : next.kind === "lap"
      ? `Закрыть круг ${next.lap}`
      : `Рубеж ${next.station_idx} · ${view.stations.find((s) => s.idx === next.station_idx)?.name ?? ""}`;

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
        <button
          onClick={() => {
            clearJudgeToken();
            setView(null);
          }}
          className="text-xs text-[var(--color-text-muted)] underline"
        >
          выйти
        </button>
      </header>

      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
        {!race.started_at
          ? "Гонка ещё не стартовала."
          : `Круг ${next ? next.lap : race.laps} из ${race.laps} · пройдено рубежей: ${
              next && next.kind === "station" ? (next.station_idx ?? 1) - 1 : race.stations
            } из ${race.stations}`}
      </div>

      {next ? (
        <button
          disabled={busy || !race.started_at || !!race.finished_at}
          onClick={() => act(() => festivalApi.judge.mark(next))}
          className="bg-[var(--color-brand)] px-4 py-10 text-2xl font-semibold text-white disabled:opacity-50"
        >
          {nextLabel}
        </button>
      ) : (
        <div className="bg-[var(--color-success)] px-4 py-10 text-center text-2xl font-semibold text-black">
          Финиш!
          {race.started_at && view.events.length > 0 && (
            <div className="mt-1 text-base font-normal">
              {formatClock(
                (new Date(view.events[view.events.length - 1].at).getTime() -
                  new Date(race.started_at).getTime()) / 1000,
              )}
            </div>
          )}
        </div>
      )}

      {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}

      {view.score_lap !== null && <PointsForm view={view} onView={setView} />}

      <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
          <span className="text-sm font-semibold">Отмечено</span>
          <button
            disabled={busy || view.events.length === 0}
            onClick={() => act(() => festivalApi.judge.undo())}
            className="text-sm text-[var(--color-danger)] disabled:opacity-40"
          >
            Отменить последнюю
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto text-sm">
          {[...view.events].reverse().map((e) => (
            <div
              key={e.id}
              className="flex justify-between border-b border-[var(--color-border)] px-3 py-1.5"
            >
              <span>
                {e.kind === "lap" ? `круг ${e.lap} закрыт` : `рубеж ${e.station_idx} (круг ${e.lap})`}
              </span>
              <span className="text-[var(--color-text-muted)]">
                {new Date(e.at).toLocaleTimeString("ru-RU")}
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
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <button
                  disabled={busy}
                  onClick={() => act(() => festivalApi.judge.deletePoint(p.id))}
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
