import { useEffect, useState } from "react";

// Тикающие часы гонки. «Сейчас» нельзя читать прямо в рендере: значение меняется
// само, и рендер перестаёт быть чистым. До первого тика возвращается 0 —
// вызывающий показывает прочерк.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = (): void => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
