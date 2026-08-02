import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { shiftsApi } from "./shifts-api";
import type { EventBoard, EventMember } from "./event-types";

// Вкладка «День рождения»: смена без традиций, искры выдаются руками. Награда
// = название + число + кому. Ребёнок видит её только после «Объявить» — до
// сцены она не уходит на клиент вовсе.

function fio(m: { l_name: string; f_name: string; m_name: string | null }) {
  return `${m.l_name} ${m.f_name} ${m.m_name ?? ""}`.trim();
}

function when(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventPage() {
  const { id } = useParams();
  const shiftId = Number(id);
  const [board, setBoard] = useState<EventBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(shiftId)) return;
    let active = true;
    shiftsApi
      .event(shiftId)
      .then((b) => active && setBoard(b))
      .catch(() => active && setError("Не удалось загрузить смену."));
    return () => {
      active = false;
    };
  }, [shiftId]);

  // Каждая правка возвращает доску целиком — состояние одно, склеивать нечего.
  async function run(action: () => Promise<EventBoard>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setBoard(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  if (error && !board) {
    return <div className="text-[var(--color-danger)]">{error}</div>;
  }
  if (!board) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        to={`/admin/shifts/${shiftId}`}
        className="text-sm text-[var(--color-brand)]"
      >
        ← Смена {shiftId}
      </Link>

      <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <div>
          <h2 className="text-base font-semibold">
            🎂 {board.shift_id} · {board.name ?? "День рождения"}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {board.start_date} – {board.end_date} · участников:{" "}
            {board.members.length}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={board.event_mode}
            disabled={busy}
            onChange={(e) =>
              run(() => shiftsApi.setEventMode(shiftId, e.target.checked))
            }
          />
          режим события
        </label>
      </div>

      {!board.event_mode && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] px-4 py-2.5 text-[13px] text-[var(--color-warning)]">
          Пока режим события выключен, награды выдавать нельзя. Традиции,
          человек дня и КТБ этой смены не касаются.
        </div>
      )}

      {error && <div className="text-[13px] text-[var(--color-danger)]">{error}</div>}

      <RosterPanel board={board} busy={busy} run={run} />
      <AwardForm board={board} busy={busy} run={run} />
      <DrawPanel board={board} busy={busy} run={run} />
      <AwardList board={board} busy={busy} run={run} />
    </div>
  );
}

type Run = (action: () => Promise<EventBoard>) => Promise<void>;

// Ростер праздника: свои — одной кнопкой из соседней смены, приезжие —
// вставкой списка ФИО (тот же разбор, что у обычной смены: находит своих,
// заводит новых с логином и паролем).
function RosterPanel({
  board,
  busy,
  run,
}: {
  board: EventBoard;
  busy: boolean;
  run: Run;
}) {
  const [from, setFrom] = useState("");
  const [names, setNames] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  async function paste(): Promise<void> {
    const list = names
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    await run(async () => {
      const res = await shiftsApi.addMembers(board.shift_id, list);
      setAdded(
        `добавлено: ${res.rostered}, новых аккаунтов: ${res.created}` +
          (res.skipped.length ? `, пропущено строк: ${res.skipped.length}` : ""),
      );
      setNames("");
      return shiftsApi.event(board.shift_id);
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">Участники</h3>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="номер смены"
            className="w-32 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
          />
          <Button
            disabled={busy || !Number.isInteger(Number(from))}
            onClick={() =>
              run(() => shiftsApi.copyEventRoster(board.shift_id, Number(from)))
            }
            className="px-2.5 py-1 text-xs"
          >
            Добавить всех из смены
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            те, кто уже в списке, не задвоятся
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={4}
            placeholder={"Приезжие, по одному в строке:\nИванов Иван Иванович"}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
          />
          <div className="flex items-center gap-3">
            <Button
              disabled={busy || names.trim() === ""}
              onClick={paste}
              className="px-2.5 py-1 text-xs"
            >
              Добавить списком
            </Button>
            {added && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {added}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Выдача: одно название и число сразу нескольким детям. Команда реалити
// получает награду одним нажатием, а не строкой на человека.
function AwardForm({
  board,
  busy,
  run,
}: {
  board: EventBoard;
  busy: boolean;
  run: Run;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [published, setPublished] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return board.members;
    return board.members.filter((m) => fio(m).toLowerCase().includes(q));
  }, [board.members, query]);

  function toggle(userId: string): void {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const value = Number(amount);
  const canSubmit =
    !busy &&
    board.event_mode &&
    title.trim() !== "" &&
    Number.isInteger(value) &&
    value !== 0 &&
    picked.size > 0;

  async function submit(): Promise<void> {
    await run(async () => {
      const next = await shiftsApi.addEventAwards(
        board.shift_id,
        [...picked],
        title.trim(),
        value,
        published,
      );
      setPicked(new Set());
      return next;
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">Выдать искры</h3>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="за что — «Реалити-шоу Затмение»"
            className="min-w-64 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="сколько"
            className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
          />
          <label className="flex items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            сразу объявить
          </label>
          <Button
            disabled={!canSubmit}
            onClick={submit}
            className="px-2.5 py-1 text-xs"
          >
            Выдать {picked.size > 0 ? `(${picked.size})` : ""}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="поиск по фамилии"
            className="w-64 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
          />
          <button
            type="button"
            onClick={() => setPicked(new Set(shown.map((m) => m.user_id)))}
            className="text-xs text-[var(--color-brand)]"
          >
            выбрать всех
          </button>
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="text-xs text-[var(--color-text-muted)]"
          >
            снять
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          {shown.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
              Участников пока нет.
            </p>
          ) : (
            shown.map((m) => <MemberRow key={m.user_id} m={m} picked={picked.has(m.user_id)} onToggle={toggle} />)
          )}
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  m,
  picked,
  onToggle,
}: {
  m: EventMember;
  picked: boolean;
  onToggle: (userId: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-1.5 text-[13px] last:border-b-0">
      <span className="flex items-center gap-2">
        <input type="checkbox" checked={picked} onChange={() => onToggle(m.user_id)} />
        {fio(m)}
      </span>
      <span className="shrink-0 text-xs">
        <span className="text-[var(--color-brand)]">
          {m.awarded.toLocaleString("ru-RU")}
        </span>
        {m.pending !== 0 && (
          <span className="ml-2 text-[var(--color-warning)]">
            +{m.pending.toLocaleString("ru-RU")} ждёт
          </span>
        )}
      </span>
    </label>
  );
}

// Розыгрыш: каждому участнику случайное число искр в сундук. Числа раздаёт
// сервер, ребёнок узнаёт своё только открыв сундук — искры засчитываются тем же
// нажатием. Поэтому «перебросить» трогает лишь неоткрытые.
function DrawPanel({
  board,
  busy,
  run,
}: {
  board: EventBoard;
  busy: boolean;
  run: Run;
}) {
  const [min, setMin] = useState("50");
  const [max, setMax] = useState("350");
  const [show, setShow] = useState(false);

  const lo = Number(min);
  const hi = Number(max);
  const okBounds =
    Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && hi >= lo;
  const left = board.members.length - board.prize_count;
  const drawn = board.members.filter((m) => m.prize !== null);

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">🎁 Розыгрыш</h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          сундуков: {board.prize_count} из {board.members.length} · открыли:{" "}
          {board.prize_opened_count}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={min}
            onChange={(e) => setMin(e.target.value)}
            inputMode="numeric"
            className="w-20 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
          />
          <span className="text-[13px] text-[var(--color-text-muted)]">—</span>
          <input
            value={max}
            onChange={(e) => setMax(e.target.value)}
            inputMode="numeric"
            className="w-20 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
          />
          <Button
            disabled={busy || !okBounds || !board.event_mode || left === 0}
            onClick={() => run(() => shiftsApi.drawPrizes(board.shift_id, lo, hi))}
            className="px-2.5 py-1 text-xs"
          >
            Разыграть{left > 0 && board.prize_count > 0 ? ` (${left} без сундука)` : ""}
          </Button>
          <Button
            disabled={busy || !okBounds || board.prize_count === 0}
            onClick={() =>
              run(() => shiftsApi.redrawPrizes(board.shift_id, lo, hi))
            }
            className="px-2.5 py-1 text-xs"
          >
            Перебросить неоткрытые
          </Button>
          <button
            type="button"
            disabled={busy || board.prize_count === 0}
            onClick={() => run(() => shiftsApi.clearPrizes(board.shift_id))}
            className="text-xs text-[var(--color-danger)]"
          >
            отменить неоткрытые
          </button>
        </div>

        {drawn.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="text-xs text-[var(--color-brand)]"
            >
              {show ? "скрыть числа" : "показать, кому сколько выпало"}
            </button>
            {show && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                {drawn.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-1.5 text-[13px] last:border-b-0"
                  >
                    <span>{fio(m)}</span>
                    <span className="shrink-0">
                      <span className="font-medium">
                        +{(m.prize ?? 0).toLocaleString("ru-RU")}
                      </span>
                      <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                        {m.prize_opened ? "открыл" : "не открыл"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Выданное: тумблер «объявлено» у каждой строки. Снятие прячет награду обратно
// и убирает её из рейтинга — объявили не вовремя, откатили.
function AwardList({
  board,
  busy,
  run,
}: {
  board: EventBoard;
  busy: boolean;
  run: Run;
}) {
  const name = useMemo(
    () => new Map(board.members.map((m) => [m.user_id, fio(m)])),
    [board.members],
  );
  const pending = board.awards.filter((a) => !a.published).length;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">
          Выданное ({board.awards.length})
        </h3>
        <Button
          disabled={busy || pending === 0}
          onClick={() => run(() => shiftsApi.publishEventAwards(board.shift_id))}
          className="px-2.5 py-1 text-xs"
        >
          Объявить все ждущие{pending > 0 ? ` (${pending})` : ""}
        </Button>
      </div>
      {board.awards.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Пока ничего не выдано.
        </p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-4 py-1.5 font-medium">Время</th>
              <th className="px-4 py-1.5 font-medium">Кому</th>
              <th className="px-4 py-1.5 font-medium">За что</th>
              <th className="px-4 py-1.5 text-right font-medium">Искры</th>
              <th className="px-4 py-1.5 text-center font-medium">Объявлено</th>
              <th className="px-4 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {board.awards.map((a) => (
              <tr key={a.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                  {when(a.created_at)}
                </td>
                <td className="px-4 py-1.5">{name.get(a.user_id) ?? "—"}</td>
                <td className="px-4 py-1.5">{a.title}</td>
                <td className="px-4 py-1.5 text-right font-medium">
                  {a.amount > 0 ? "+" : ""}
                  {a.amount.toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={a.published}
                    disabled={busy}
                    onChange={(e) =>
                      run(() =>
                        shiftsApi.setEventAwardPublished(
                          board.shift_id,
                          a.id,
                          e.target.checked,
                        ),
                      )
                    }
                  />
                </td>
                <td className="px-4 py-1.5 text-right">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        shiftsApi.deleteEventAward(board.shift_id, a.id),
                      )
                    }
                    className="text-xs text-[var(--color-danger)]"
                  >
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
