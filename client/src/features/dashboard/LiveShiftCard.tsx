import { useEffect, useState } from "react";
import type { LiveShiftProgress } from "../sparks/types";

// Остаток до момента раскрытия, в виде «7 ч 12 мин» / «4:31».
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

// Текущая смена в кабинете ребёнка: сколько искр уже открыто, прирост за
// последний день и сколько осталось до следующего раскрытия. Закрытые дни
// сюда не приходят вовсе — их отсекает сервер.
export function LiveShiftCard({
  live,
  onReveal,
}: {
  live: LiveShiftProgress;
  onReveal: () => void;
}) {
  const left = useCountdown(live.next_reveal_at, onReveal);
  const last = live.days[live.days.length - 1];

  return (
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
        {last && last.delta > 0 && (
          <div>
            <div className="text-xs text-[var(--color-text-muted)]">
              День {last.day_number}
            </div>
            <span className="text-lg font-semibold">
              +{last.delta.toLocaleString("ru-RU")}
            </span>
          </div>
        )}
        <div className="text-xs text-[var(--color-text-muted)]">
          открыто дней: {live.days.length} из {live.day_count}
        </div>
      </div>

      {live.days.length > 0 && (
        <div className="flex flex-col border-t border-[var(--color-border)]">
          {[...live.days].reverse().map((d) => (
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
          Первые искры смены откроются
          {live.next_reveal_at
            ? ` ${new Date(live.next_reveal_at).toLocaleString("ru-RU")}`
            : " позже"}
          .
        </div>
      )}
    </div>
  );
}
