import { useEffect, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { ACHIEVEMENT_COLUMNS } from "../sparks/columns";
import { sparksApi } from "../sparks/sparks-api";
import type { LiveDay, LiveShiftProgress } from "../sparks/types";

const LABEL = new Map(ACHIEVEMENT_COLUMNS.map((c) => [c.key, c.full]));

// Остаток до раскрытия: «7 ч 12 мин» вдалеке, «4:31» на последней минуте.
function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Тикает раз в секунду до `at`; когда время вышло — один раз дёргает onElapsed,
// чтобы страница перезапросила данные и показала новый день.
function useCountdown(at: string | null, onElapsed: () => void): number | null {
  const [left, setLeft] = useState<number | null>(
    at ? Date.parse(at) - Date.now() : null,
  );

  useEffect(() => {
    if (!at) {
      setLeft(null);
      return;
    }
    let fired = false;
    const tick = (): void => {
      const ms = Date.parse(at) - Date.now();
      setLeft(ms);
      if (ms <= 0 && !fired) {
        fired = true;
        onElapsed();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  return left;
}

// Нераскрытая карточка: ребёнок видит, что искры пришли, но не сколько —
// число появляется по нажатию.
function PendingCard({
  day,
  shiftId,
  onOpened,
}: {
  day: LiveDay;
  shiftId: number;
  onOpened: (p: LiveShiftProgress | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);

  async function open(): Promise<void> {
    setBusy(true);
    try {
      const next = await sparksApi.openLiveDay(shiftId, day.day_number);
      setOpened(true);
      onOpened(next);
    } finally {
      setBusy(false);
    }
  }

  if (!opened) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[var(--color-brand)] bg-[var(--color-surface)] p-4 text-center shadow-[var(--shadow-card)]">
        <div className="text-base font-semibold">✨ Твои искры за вчера</div>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          День {day.day_number} · {day.date}
        </p>
        <Button onClick={open} disabled={busy} className="mt-3 px-5 py-2">
          {busy ? "Открываем…" : "Открыть"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[var(--color-brand)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="text-center">
        <div className="text-[13px] text-[var(--color-text-muted)]">
          День {day.day_number} · {day.date}
        </div>
        <div className="mt-1 text-3xl font-bold text-[var(--color-brand)]">
          +{day.delta.toLocaleString("ru-RU")}
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">искр</div>
      </div>
      {day.items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {day.items.map((it) => (
            <li
              key={it.key}
              className="flex items-center justify-between gap-3 text-[13px]"
            >
              <span>{LABEL.get(it.key) ?? it.key}</span>
              {it.amount > 1 && (
                <span className="text-[var(--color-text-muted)]">
                  ×{it.amount}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Текущая смена в кабинете ребёнка: карточка нового дня, накопленный итог и
// история уже открытых дней. Закрытые дни сюда не приходят вовсе — их
// отсекает сервер.
export function LiveShiftCard({
  live,
  onReveal,
  onProgress,
}: {
  live: LiveShiftProgress;
  onReveal: () => void;
  onProgress: (p: LiveShiftProgress | null) => void;
}) {
  const left = useCountdown(live.next_reveal_at, onReveal);
  const history = live.days.filter((d) => d.day_number !== live.pending?.day_number);

  return (
    <div className="flex flex-col gap-3">
      {live.pending && (
        <PendingCard
          day={live.pending}
          shiftId={live.shift_id}
          onOpened={onProgress}
        />
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-brand)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            Смена {live.shift_id}
            {live.name ? ` · ${live.name}` : ""} — идёт сейчас
          </h2>
          {live.next_reveal_at && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {left !== null && left > 0
                ? `следующие искры через ${formatLeft(left)}`
                : "обновляем…"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-4 px-4 py-3">
          <div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Искр за смену
            </div>
            <span className="text-2xl font-bold text-[var(--color-brand)]">
              {live.sparks.toLocaleString("ru-RU")}
            </span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            открыто дней: {live.days.length} из {live.day_count}
          </div>
        </div>

        {history.length > 0 && (
          <div className="flex flex-col border-t border-[var(--color-border)]">
            {[...history].reverse().map((d) => (
              <div
                key={d.day_number}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-1.5 text-[13px] last:border-b-0"
              >
                <span>День {d.day_number}</span>
                <span className="text-[var(--color-text-muted)]">{d.date}</span>
                <span className="font-medium">
                  {d.delta > 0 ? `+${d.delta.toLocaleString("ru-RU")}` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {live.days.length === 0 && (
          <div className="px-4 pb-3 text-[13px] text-[var(--color-text-muted)]">
            Искры за день появятся здесь, когда вожатые подведут итоги.
          </div>
        )}
      </div>
    </div>
  );
}
