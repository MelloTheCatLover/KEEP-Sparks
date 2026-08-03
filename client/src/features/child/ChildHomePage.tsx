import { useEffect, useState } from "react";
import { sparksApi } from "../sparks/sparks-api";
import type { MyBreakdown } from "../sparks/types";
import { SparksDashboard } from "../dashboard/SparksDashboard";

// Child's personal cabinet: their own stats, overall + current placement, and
// per-shift history. Read-only.
export function ChildHomePage() {
  const [data, setData] = useState<MyBreakdown | null>(null);
  const [error, setError] = useState(false);
  // Растёт, когда данные пора перезапросить: раскрылись составы КТБ или пора
  // проверить, не отдал ли админ искры за очередной день.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    sparksApi
      .myBreakdown()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [reload]);

  // Искры за день отдаёт админ флагом, момент заранее не известен — вместо
  // отсчёта страница раз в минуту перезапрашивает статистику, пока у ребёнка
  // есть что открывать: идущая смена или неоткрытые составы КТБ.
  const watching = Boolean(data?.live || data?.ktb);
  useEffect(() => {
    if (!watching) return;
    const id = setInterval(() => setReload((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [watching]);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить статистику.
      </div>
    );
  }
  if (!data) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }
  return (
    <SparksDashboard
      data={data}
      onReveal={() => setReload((n) => n + 1)}
      inlineShift={false}
    />
  );
}
