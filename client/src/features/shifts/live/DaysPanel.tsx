import { useState } from "react";
import type { LiveBoard } from "./live-types";

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Подведение дней. Пока день не подведён, детям он не открывается, сколько бы
// времени ни прошло: иначе ребёнок увидит полупустой день, а искры дозальются
// позже и итог прыгнет. Подведённый после полудня день ждёт следующего — искры
// всегда приходят в один и тот же час.
export function DaysPanel({
  board,
  onToggle,
}: {
  board: LiveBoard;
  onToggle: (day: number, ready: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState<number | null>(null);

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
        «Подвести» = за этот день всё введено. Дети увидят искры в ближайшие
        12:00 после подведения, не раньше.
      </p>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="py-1 font-medium">День</th>
            <th className="py-1 font-medium">Дата</th>
            <th className="py-1 font-medium">Начислено</th>
            <th className="py-1 font-medium">Откроется</th>
            <th className="py-1 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {board.days.map((d) => (
            <tr
              key={d.day_number}
              className="border-t border-[var(--color-border)]"
            >
              <td className="py-1.5">{d.day_number}</td>
              <td className="py-1.5 text-[var(--color-text-muted)]">{d.date}</td>
              <td className="py-1.5 text-[var(--color-text-muted)]">
                {d.scored_children > 0 ? `${d.scored_children} чел.` : "—"}
              </td>
              <td className="py-1.5">
                {d.revealed ? (
                  <span className="text-[var(--color-brand)]">открыт</span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">
                    {when(d.reveal_at)}
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right">
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
                  {d.ready_at ? "Снять" : "Подвести"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
