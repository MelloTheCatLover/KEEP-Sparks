import { useEffect, useState } from "react";

// Остаток до раскрытия: «7 ч 12 мин» вдалеке, «4:31» на последней минуте.
export function formatLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Тикает раз в секунду до `at`; когда время вышло — один раз дёргает onElapsed,
// чтобы страница перезапросила данные и показала то, что открылось.
export function useCountdown(
  at: string | null,
  onElapsed: () => void,
): number | null {
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
