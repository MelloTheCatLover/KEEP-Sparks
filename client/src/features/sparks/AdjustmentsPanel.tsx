import { useEffect, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { sparksApi } from "./sparks-api";
import type { SparkAdjustment } from "./types";

// Admin panel on a child's page: grant bonuses (amount > 0, shown to the child)
// or penalties (amount < 0, hidden from the child). Both change the total.
export function AdjustmentsPanel({
  childId,
  onChange,
}: {
  childId: string;
  onChange: () => void;
}) {
  const [rows, setRows] = useState<SparkAdjustment[] | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    sparksApi
      .adjustments(childId)
      .then(setRows)
      .catch(() => setRows([]));
  }

  useEffect(load, [childId]);

  async function add(sign: 1 | -1) {
    const n = Math.abs(parseInt(amount, 10));
    if (!Number.isInteger(n) || n === 0) {
      setError("Введите число больше нуля");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sparksApi.addAdjustment(childId, sign * n, reason.trim() || null);
      setAmount("");
      setReason("");
      load();
      onChange();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      await sparksApi.deleteAdjustment(id);
      load();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Бонусы и штрафы</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Бонус виден ребёнку в его кабинете, штраф — нет. Оба меняют сумму искр.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Искры"
          className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина (необязательно)"
          className="min-w-40 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
        />
        <Button
          onClick={() => add(1)}
          disabled={busy}
          className="px-3 py-1 text-sm"
        >
          + Бонус
        </Button>
        <button
          onClick={() => add(-1)}
          disabled={busy}
          className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] px-3 py-1 text-sm text-[var(--color-danger)] disabled:opacity-50"
        >
          − Штраф
        </button>
        {error && (
          <span className="text-xs text-[var(--color-danger)]">{error}</span>
        )}
      </div>

      <div className="flex flex-col">
        {rows === null ? (
          <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
            Загрузка…
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
            Пока нет корректировок.
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] px-4 py-2.5 first:border-t-0"
            >
              <div className="min-w-0">
                <span
                  className={
                    "font-semibold " +
                    (r.amount > 0
                      ? "text-[var(--color-brand)]"
                      : "text-[var(--color-danger)]")
                  }
                >
                  {r.amount > 0 ? "+" : "−"}
                  {Math.abs(r.amount).toLocaleString("ru-RU")}
                </span>
                <span className="ml-2 text-sm">{r.reason ?? "—"}</span>
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                  {r.created_at.slice(0, 10)}
                  {r.amount > 0 ? "" : " · скрыто"}
                </span>
              </div>
              <button
                onClick={() => remove(r.id)}
                disabled={busy}
                className="shrink-0 text-xs text-[var(--color-danger)] disabled:opacity-50"
              >
                Удалить
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
