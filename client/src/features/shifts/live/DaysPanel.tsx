import { Fragment, useEffect, useState } from "react";
import { ACHIEVEMENT_COLUMNS } from "../../sparks/columns";
import { fio } from "./PeoplePicker";
import type { DayAwardRow, LiveBoard } from "./live-types";

const LABEL = new Map(ACHIEVEMENT_COLUMNS.map((c) => [c.key, c.full]));

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Что получит один ребёнок: «День присутствия · Человек дня» и т.п.
function what(items: DayAwardRow["items"]): string {
  if (items.length === 0) return "—";
  return items
    .map(
      (i) => (LABEL.get(i.key) ?? i.key) + (i.amount > 1 ? ` ×${i.amount}` : ""),
    )
    .join(" · ");
}

// Кто и что получит за день. Смотрится до нажатия «Отдать искры»: видно
// поимённо весь ростер, включая тех, кому за день не досталось ничего, кроме
// дня присутствия. Числа — уже с коэффициентом смены, ровно те, что увидит
// ребёнок в сундуке.
function Preview({
  shiftId,
  day,
  load,
}: {
  shiftId: number;
  day: number;
  load: (shiftId: number, day: number) => Promise<DayAwardRow[]>;
}) {
  const [rows, setRows] = useState<DayAwardRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let active = true;
    load(shiftId, day)
      .then((r) => active && setRows(r))
      .catch(() => active && setErr(true));
    return () => {
      active = false;
    };
  }, [shiftId, day, load]);

  if (err) {
    return (
      <div className="px-2 py-2 text-xs text-[var(--color-danger)]">
        Не удалось загрузить выдачу за день.
      </div>
    );
  }
  if (rows === null) {
    return (
      <div className="px-2 py-2 text-xs text-[var(--color-text-muted)]">
        Считаем…
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + r.delta, 0);

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="text-xs text-[var(--color-text-muted)]">
        Получат искры: {rows.filter((r) => r.delta > 0).length} из {rows.length}{" "}
        · всего {total.toLocaleString("ru-RU")} искр
      </div>
      <div className="max-h-80 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
        <table className="w-full text-[13px]">
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.user_id}
                className="border-b border-[var(--color-border)] last:border-b-0"
              >
                <td className="w-8 px-2 py-1 align-top text-xs text-[var(--color-text-muted)]">
                  {r.number ?? ""}
                </td>
                <td className="px-1 py-1 align-top">{fio(r)}</td>
                <td className="px-1 py-1 align-top text-xs text-[var(--color-text-muted)]">
                  {what(r.items)}
                </td>
                <td className="w-20 px-2 py-1 text-right align-top font-medium">
                  {r.delta > 0 ? `+${r.delta.toLocaleString("ru-RU")}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Выдача искр за день. Никакого часа раскрытия: день виден ребёнку ровно
// столько, сколько поднят флаг, и «Забрать» прячет его обратно — админ вводит
// итоги когда получится и сам решает, когда их показать.
//
// Перед выдачей день раскрывается в поимённый список: сундук у ребёнка обратно
// уже не заберёшь по-хорошему, поэтому смотреть, кто что получит, нужно здесь.
export function DaysPanel({
  board,
  shiftId,
  onToggle,
  loadAwards,
}: {
  board: LiveBoard;
  shiftId: number;
  onToggle: (day: number, ready: boolean) => Promise<void>;
  loadAwards: (shiftId: number, day: number) => Promise<DayAwardRow[]>;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  async function toggle(day: number, ready: boolean): Promise<void> {
    setBusy(day);
    try {
      await onToggle(day, ready);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold">Дни смены</h3>
      <p className="text-xs text-[var(--color-text-muted)]">
        «Отдать искры» = дети видят этот день и получают сундук. Пока флаг не
        поднят, для них дня нет вовсе; «Забрать» скрывает его обратно. День
        присутствия начисляется всем автоматически, поэтому сундук приходит
        каждому.
      </p>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="py-1 font-medium">День</th>
            <th className="py-1 font-medium">Дата</th>
            <th className="py-1 font-medium">Начислено</th>
            <th className="py-1 font-medium">Искры</th>
            <th className="py-1 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {board.days.map((d) => (
            <Fragment key={d.day_number}>
              <tr className="border-t border-[var(--color-border)]">
                <td className="py-1.5">{d.day_number}</td>
                <td className="py-1.5 text-[var(--color-text-muted)]">
                  {d.date}
                </td>
                <td className="py-1.5 text-[var(--color-text-muted)]">
                  {d.scored_children > 0 ? `${d.scored_children} чел.` : "—"}
                </td>
                <td className="py-1.5">
                  {d.revealed ? (
                    <span className="text-[var(--color-brand)]">
                      отданы · {when(d.ready_at)}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">
                      скрыты
                    </span>
                  )}
                </td>
                <td className="py-1.5">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        setOpen(open === d.day_number ? null : d.day_number)
                      }
                      className="text-xs text-[var(--color-brand)]"
                    >
                      {open === d.day_number ? "Свернуть" : "Кто что получит"}
                    </button>
                    <button
                      onClick={() => toggle(d.day_number, !d.ready_at)}
                      disabled={busy === d.day_number}
                      className={
                        "rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs disabled:opacity-50 " +
                        (d.ready_at
                          ? "border-[var(--color-border)] text-[var(--color-text-muted)]"
                          : "border-[var(--color-brand)] text-[var(--color-brand)]")
                      }
                    >
                      {d.ready_at ? "Забрать" : "Отдать искры"}
                    </button>
                  </div>
                </td>
              </tr>
              {open === d.day_number && (
                <tr>
                  <td colSpan={5}>
                    <Preview
                      shiftId={shiftId}
                      day={d.day_number}
                      load={loadAwards}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
