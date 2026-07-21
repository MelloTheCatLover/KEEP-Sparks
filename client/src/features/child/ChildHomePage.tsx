import { useEffect, useState } from "react";
import { sparksApi } from "../sparks/sparks-api";
import type { MyBreakdown } from "../sparks/types";
import { SparksDashboard } from "../dashboard/SparksDashboard";

// Child's personal cabinet: their own stats, overall + current placement, and
// per-shift history. Read-only.
export function ChildHomePage() {
  const [data, setData] = useState<MyBreakdown | null>(null);
  const [error, setError] = useState(false);
  // Растёт, когда истёк отсчёт до раскрытия очередного дня, — перезапрашивает
  // статистику, чтобы новые искры появились без перезагрузки страницы.
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
    <SparksDashboard data={data} onReveal={() => setReload((n) => n + 1)} />
  );
}
