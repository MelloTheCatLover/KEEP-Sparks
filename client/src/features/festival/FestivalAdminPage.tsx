import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { festivalApi } from "./festival-api";
import { formatClock } from "./format";
import { useNow } from "./use-now";
import type {
  FestivalAdminBoard,
  FestivalRace,
  FestivalRaceSettings,
  FestivalRosterRow,
} from "./types";

// Подготовка фестиваля: гонка, рубежи, 22 участника со своими судьями и
// правки постфактум. К искрам раздел отношения не имеет — участники здесь
// просто номера.

// Ростер вставляется списком: «номер; ФИ; команда; судья; группа». Группа —
// стартовая шестёрка; пустая считается из номера. Разделителем годятся и точка
// с запятой, и табуляция — так строки переживают вставку из таблицы.
function parseRoster(text: string): {
  rows: FestivalRosterRow[];
  errors: string[];
} {
  const rows: FestivalRosterRow[] = [];
  const errors: string[] = [];

  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .forEach((line, i) => {
      const parts = line.split(/[;\t]/).map((p) => p.trim());
      const number = Number(parts[0]);
      if (!Number.isInteger(number) || number <= 0) {
        errors.push(`Строка ${i + 1}: не разобран номер — «${line}»`);
        return;
      }
      if (!parts[1]) {
        errors.push(`Строка ${i + 1}: нет фамилии и имени`);
        return;
      }
      const heat = Number(parts[4]);
      rows.push({
        number,
        name: parts[1],
        team: parts[2] || null,
        judge_name: parts[3] || null,
        heat: Number.isInteger(heat) && heat > 0 ? heat : null,
      });
    });

  return { rows, errors };
}

function rosterToText(board: FestivalAdminBoard): string {
  return board.participants
    .map((p) => {
      const judge = board.judges.find((j) => j.participant_id === p.id);
      return [p.number, p.name, p.team ?? "", judge?.name ?? "", p.heat].join("; ");
    })
    .join("\n");
}

function CreateRace({ onCreated }: { onCreated: (race: FestivalRace) => void }) {
  const [title, setTitle] = useState("Фестиваль");
  const [slug, setSlug] = useState("festival");
  const [laps, setLaps] = useState(3);
  const [stations, setStations] = useState(6);
  const [penalty, setPenalty] = useState(15);
  const [heatSize, setHeatSize] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await festivalApi.admin.create({
          title,
          slug,
          laps,
          stations,
          penalty_seconds: penalty,
          heat_size: heatSize,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать гонку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 p-4">
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Название
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-48 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Адрес экрана
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-40 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Кругов
        <input
          type="number"
          value={laps}
          onChange={(e) => setLaps(Number(e.target.value))}
          className="w-20 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Рубежей
        <input
          type="number"
          value={stations}
          onChange={(e) => setStations(Number(e.target.value))}
          className="w-20 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Штраф, с
        <input
          type="number"
          value={penalty}
          onChange={(e) => setPenalty(Number(e.target.value))}
          className="w-20 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        В группе
        <input
          type="number"
          value={heatSize}
          onChange={(e) => setHeatSize(Number(e.target.value))}
          className="w-20 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
        />
      </label>
      <Button disabled={busy} onClick={submit} className="px-3 py-1.5 text-xs">
        Создать гонку
      </Button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}

function RosterPanel({
  board,
  onBoard,
}: {
  board: FestivalAdminBoard;
  onBoard: (b: FestivalAdminBoard) => void;
}) {
  const [text, setText] = useState(() => rosterToText(board));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseRoster(text), [text]);

  async function save(): Promise<void> {
    if (parsed.errors.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      onBoard(await festivalApi.admin.setRoster(board.race.id, parsed.rows));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Участники и судьи</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Строка на участника: <code>номер; ФИ; команда; судья; группа</code>.
          Группа — стартовая шестёрка; оставьте пустой, и она посчитается из
          номера. Каждому сразу выпускается судья со своим кодом. Пересохранить
          список можно, пока в гонке нет ни одной отметки.
        </p>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-mono text-[12px] text-[var(--color-text)]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={busy || parsed.errors.length > 0} onClick={save} className="px-3 py-1.5 text-xs">
            Сохранить список ({parsed.rows.length})
          </Button>
          {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
          {parsed.errors.map((e) => (
            <span key={e} className="text-xs text-[var(--color-danger)]">
              {e}
            </span>
          ))}
        </div>

        {board.judges.length > 0 && (
          <table className="mt-2 w-full text-[13px]">
            <thead className="text-left text-xs text-[var(--color-text-muted)]">
              <tr>
                <th className="py-1">№</th>
                <th>Гр.</th>
                <th>Участник</th>
                <th>Команда</th>
                <th>Судья</th>
                <th>Код</th>
              </tr>
            </thead>
            <tbody>
              {board.participants.map((p) => {
                const judge = board.judges.find((j) => j.participant_id === p.id);
                return (
                  <tr key={p.id} className="border-t border-[var(--color-border)]">
                    <td className="py-1 font-semibold">{p.number}</td>
                    <td className="text-[var(--color-text-muted)]">{p.heat}</td>
                    <td>{p.name}</td>
                    <td className="text-[var(--color-text-muted)]">{p.team ?? "—"}</td>
                    <td className="text-[var(--color-text-muted)]">{judge?.name ?? "—"}</td>
                    <td className="font-mono">{judge?.pin ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StationsPanel({
  board,
  onBoard,
}: {
  board: FestivalAdminBoard;
  onBoard: (b: FestivalAdminBoard) => void;
}) {
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: board.race.stations }, (_, i) =>
      board.stations.find((s) => s.idx === i + 1)?.name ?? `Рубеж ${i + 1}`,
    ),
  );
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    setBusy(true);
    try {
      onBoard(await festivalApi.admin.setStations(board.race.id, names));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Рубежи</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Только подписи для экрана показа: порядок жёсткий, кодов у рубежей нет.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2 p-4">
        {names.map((name, i) => (
          <label
            key={i}
            className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]"
          >
            {i + 1}
            <input
              value={name}
              onChange={(e) =>
                setNames((cur) => cur.map((n, j) => (j === i ? e.target.value : n)))
              }
              className="w-36 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
            />
          </label>
        ))}
        <Button disabled={busy} onClick={save} className="px-3 py-1.5 text-xs">
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function LogPanel({
  board,
  onBoard,
}: {
  board: FestivalAdminBoard;
  onBoard: (b: FestivalAdminBoard) => void;
}) {
  const name = (participantId: number): string => {
    const p = board.participants.find((x) => x.id === participantId);
    return p ? `№${p.number} ${p.name}` : `#${participantId}`;
  };

  const events = [...board.events].reverse().slice(0, 60);
  const points = [...board.points].reverse().slice(0, 60);
  const penalties = [...board.penalties].reverse().slice(0, 60);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold">Отметки</h2>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 text-[13px]">
          {events.length === 0 && (
            <p className="p-2 text-xs text-[var(--color-text-muted)]">Пока пусто.</p>
          )}
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-2 py-1"
            >
              <span>
                {name(e.participant_id)} ·{" "}
                {e.kind === "start"
                  ? "старт"
                  : e.kind === "lap"
                    ? `круг ${e.lap} закрыт`
                    : `рубеж ${e.station_idx} (круг ${e.lap})`}
              </span>
              <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {new Date(e.at).toLocaleTimeString("ru-RU")}
                <button
                  onClick={() =>
                    festivalApi.admin.deleteEvent(e.id).then(onBoard)
                  }
                  className="text-[var(--color-danger)]"
                >
                  снять
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold">Баллы</h2>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 text-[13px]">
          {points.length === 0 && (
            <p className="p-2 text-xs text-[var(--color-text-muted)]">Пока пусто.</p>
          )}
          {points.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-2 py-1"
            >
              <span>
                {name(p.participant_id)} · круг {p.lap} ·{" "}
                <b className={p.points < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}>
                  {p.points > 0 ? `+${p.points}` : p.points}
                </b>
              </span>
              <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {new Date(p.at).toLocaleTimeString("ru-RU")}
                <button
                  onClick={() => festivalApi.admin.deletePoint(p.id).then(onBoard)}
                  className="text-[var(--color-danger)]"
                >
                  снять
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            Штрафы (+{board.race.penalty_seconds} с каждый)
          </h2>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 text-[13px]">
          {penalties.length === 0 && (
            <p className="p-2 text-xs text-[var(--color-text-muted)]">Пока пусто.</p>
          )}
          {penalties.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-2 py-1"
            >
              <span>
                {name(p.participant_id)} · круг {p.lap}
              </span>
              <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {new Date(p.at).toLocaleTimeString("ru-RU")}
                <button
                  onClick={() => festivalApi.admin.deletePenalty(p.id).then(onBoard)}
                  className="text-[var(--color-danger)]"
                >
                  снять
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// Настройки гонки прямо на странице: дистанция, цена штрафа, размер стартовой
// группы. Круги и рубежи запираются, как только пошли отметки, — иначе уже
// пройденная дистанция теряет смысл.
function SettingsPanel({
  board,
  onBoard,
}: {
  board: FestivalAdminBoard;
  onBoard: (b: FestivalAdminBoard) => void;
}) {
  const [form, setForm] = useState<FestivalRaceSettings>({
    title: board.race.title,
    laps: board.race.laps,
    stations: board.race.stations,
    penalty_seconds: board.race.penalty_seconds,
    heat_size: board.race.heat_size,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = board.events.length > 0;

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      onBoard(await festivalApi.admin.updateSettings(board.race.id, form));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не сохранилось");
    } finally {
      setBusy(false);
    }
  }

  const num = (
    label: string,
    key: "laps" | "stations" | "penalty_seconds" | "heat_size",
    disabled = false,
  ) => (
    <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
      {label}
      <input
        type="number"
        value={form[key]}
        disabled={disabled}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
        className="w-24 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)] disabled:opacity-50"
      />
    </label>
  );

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Настройки гонки</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Штраф добавляет секунды к итоговому времени. Группа — по сколько
          человек уходит со старта; отсчёт всё равно у каждого свой, его
          включает судья.
          {locked && " Круги и рубежи заперты: в гонке уже есть отметки."}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2 p-4">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Название
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-56 border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] text-[var(--color-text)]"
          />
        </label>
        {num("Кругов", "laps", locked)}
        {num("Рубежей", "stations", locked)}
        {num("Штраф, с", "penalty_seconds")}
        {num("В группе", "heat_size")}
        <Button disabled={busy} onClick={save} className="px-3 py-1.5 text-xs">
          Сохранить
        </Button>
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      </div>
    </div>
  );
}

// Правка результатов: админ может доотметить точку за судью, снять последнюю,
// начислить баллы и повесить или снять штраф — по строке на участника.
function ResultsPanel({
  board,
  onBoard,
}: {
  board: FestivalAdminBoard;
  onBoard: (b: FestivalAdminBoard) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(
    participantId: number,
    action: () => Promise<FestivalAdminBoard>,
  ): Promise<void> {
    setBusy(participantId);
    setError(null);
    try {
      onBoard(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось");
    } finally {
      setBusy(null);
    }
  }

  const rows = [...board.standings].sort((a, b) => a.number - b.number);
  const stations = board.race.stations;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Результаты участников</h2>
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full text-[13px]">
          <thead className="text-left text-xs text-[var(--color-text-muted)]">
            <tr>
              <th className="px-2 py-1">№</th>
              <th>Гр.</th>
              <th>Участник</th>
              <th>Где сейчас</th>
              <th>Время</th>
              <th>Баллы</th>
              <th>Штрафы</th>
              <th>Отметки</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const wait = busy === s.participant_id;
              return (
                <tr key={s.participant_id} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-1 font-semibold">{s.number}</td>
                  <td className="text-[var(--color-text-muted)]">{s.heat}</td>
                  <td>
                    {s.name}
                    <span className="text-[var(--color-text-muted)]">
                      {s.team ? ` · ${s.team}` : ""}
                    </span>
                  </td>
                  <td className="text-[var(--color-text-muted)]">
                    {!s.started
                      ? "на старте"
                      : s.finished
                        ? "финиш"
                        : `круг ${s.lap} · ${s.stations_done}/${stations}`}
                  </td>
                  <td className="tabular-nums">
                    {s.total_seconds !== null ? formatClock(s.total_seconds) : "—"}
                    {s.penalties > 0 && (
                      <span className="text-[var(--color-warning)]">
                        {" "}+{s.penalty_seconds}с
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="mr-1 tabular-nums">{s.points}</span>
                    <button
                      disabled={wait}
                      onClick={() =>
                        act(s.participant_id, () =>
                          festivalApi.admin.addPoints(s.participant_id, 1),
                        )
                      }
                      className="px-1.5 text-[var(--color-success)]"
                    >
                      +1
                    </button>
                    <button
                      disabled={wait}
                      onClick={() =>
                        act(s.participant_id, () =>
                          festivalApi.admin.addPoints(s.participant_id, -1),
                        )
                      }
                      className="px-1.5 text-[var(--color-danger)]"
                    >
                      −1
                    </button>
                  </td>
                  <td>
                    <span className="mr-1 tabular-nums">{s.penalties}</span>
                    <button
                      disabled={wait}
                      onClick={() =>
                        act(s.participant_id, () =>
                          festivalApi.admin.addPenalty(s.participant_id),
                        )
                      }
                      className="px-1.5 text-[var(--color-warning)]"
                    >
                      +
                    </button>
                    <button
                      disabled={wait || s.penalties === 0}
                      onClick={() =>
                        act(s.participant_id, () =>
                          festivalApi.admin.undoPenalty(s.participant_id),
                        )
                      }
                      className="px-1.5 text-[var(--color-text-muted)] disabled:opacity-40"
                    >
                      −
                    </button>
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      disabled={wait || s.finished}
                      onClick={() =>
                        act(s.participant_id, () =>
                          festivalApi.admin.mark(s.participant_id),
                        )
                      }
                      className="px-1.5 text-[var(--color-brand)] disabled:opacity-40"
                    >
                      {!s.started ? "старт" : "следующая"}
                    </button>
                    <button
                      disabled={wait || !s.started}
                      onClick={() =>
                        act(s.participant_id, () =>
                          festivalApi.admin.undoEvent(s.participant_id),
                        )
                      }
                      className="px-1.5 text-[var(--color-danger)] disabled:opacity-40"
                    >
                      снять
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FestivalAdminPage() {
  const now = useNow(1000);
  const [races, setRaces] = useState<FestivalRace[] | null>(null);
  const [raceId, setRaceId] = useState<number | null>(null);
  const [board, setBoard] = useState<FestivalAdminBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    festivalApi.admin
      .races()
      .then((list) => {
        setRaces(list);
        setRaceId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch(() => setError("Не удалось загрузить гонки"));
  }, []);

  useEffect(() => {
    if (raceId === null) return;
    let active = true;
    festivalApi.admin
      .board(raceId)
      .then((b) => active && setBoard(b))
      .catch(() => active && setError("Не удалось загрузить гонку"));
    return () => {
      active = false;
    };
  }, [raceId]);

  async function act(
    action: () => Promise<FestivalAdminBoard>,
    confirmText?: string,
  ): Promise<void> {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    try {
      setBoard(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не получилось");
    }
  }

  if (error && !board) {
    return <div className="text-[var(--color-danger)]">{error}</div>;
  }
  if (!races) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  // Пока грузится другая гонка, старая доска не показывается: у неё чужие
  // участники и чужие коды.
  const race = board && board.race.id === raceId ? board.race : null;
  const screenUrl = race ? `${location.origin}/festival/screen/${race.slug}` : "";
  const judgeUrl = `${location.origin}/festival/judge`;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold">Фестиваль — биатлон</h2>
          <span className="text-xs text-[var(--color-text-muted)]">
            отдельно от искр: участники здесь просто номера
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          {races.map((r) => (
            <button
              key={r.id}
              onClick={() => setRaceId(r.id)}
              className={
                "px-2.5 py-1 text-[13px] " +
                (r.id === raceId
                  ? "bg-[var(--color-brand)] text-white"
                  : "bg-[var(--color-elevated)] text-[var(--color-text-muted)]")
              }
            >
              {r.title}
            </button>
          ))}
          {races.length === 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Гонок ещё нет.
            </span>
          )}
        </div>
        <CreateRace
          onCreated={(created) => {
            setRaces((cur) => (cur ? [created, ...cur] : [created]));
            setRaceId(created.id);
          }}
        />
      </div>

      {race && board && board.race.id === raceId && (
        <>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">
                {race.title} · {race.laps} круга по {race.stations} рубежей ·
                штраф +{race.penalty_seconds} с
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                {race.finished_at
                  ? "гонка завершена"
                  : race.started_at
                    ? `идёт ${now === 0 ? "" : formatClock((now - new Date(race.started_at).getTime()) / 1000)}`
                    : "не стартовала"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-4">
              <Button
                disabled={!!race.started_at}
                onClick={() => act(() => festivalApi.admin.start(race.id))}
                className="px-3 py-1.5 text-xs"
              >
                Старт
              </Button>
              <Button
                disabled={!race.started_at || !!race.finished_at}
                onClick={() => act(() => festivalApi.admin.finish(race.id))}
                className="px-3 py-1.5 text-xs"
              >
                Завершить
              </Button>
              <Button
                onClick={() =>
                  act(
                    () => festivalApi.admin.reset(race.id),
                    "Сбросить все отметки и баллы этой гонки? Участники и коды судей останутся.",
                  )
                }
                className="bg-[var(--color-elevated)] px-3 py-1.5 text-xs hover:bg-[var(--color-elevated)]"
              >
                Сбросить результаты
              </Button>
              <a
                href={`/festival/screen/${race.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--color-brand)] underline"
              >
                Экран показа
              </a>
              <span className="text-xs text-[var(--color-text-muted)]">{screenUrl}</span>
              {/* Судейский адрес один на всех: кто именно вошёл, решает код. */}
              <a
                href="/festival/judge"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--color-brand)] underline"
              >
                Экран судьи
              </a>
              <span className="text-xs text-[var(--color-text-muted)]">{judgeUrl}</span>
              {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
            </div>
          </div>

          <SettingsPanel
            key={`s-${race.id}-${race.stations}-${race.laps}`}
            board={board}
            onBoard={setBoard}
          />
          <StationsPanel board={board} onBoard={setBoard} />
          <ResultsPanel board={board} onBoard={setBoard} />
          <RosterPanel key={board.participants.length} board={board} onBoard={setBoard} />
          <LogPanel board={board} onBoard={setBoard} />
        </>
      )}
    </div>
  );
}
