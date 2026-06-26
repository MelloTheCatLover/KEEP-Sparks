import { useEffect, useState } from "react";
import { sparksApi } from "./sparks-api";
import type { OverviewEntry } from "./types";

// Leaderboard by "Человек дня" count. The old data records how many times each
// child was person of the day (counts, not per-day names), so this is a ranking
// rather than a day-by-day log.
export function PeopleOfDayPage() {
  const [rows, setRows] = useState<OverviewEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    sparksApi
      .overview()
      .then((r) => active && setRows(r))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить данные.
      </div>
    );
  }
  if (!rows) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const ranked = rows
    .map((r) => ({ ...r, count: r.counts.person_of_day ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Человеки дня</h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {ranked.length}
        </span>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="px-4 py-1.5 font-medium">#</th>
            <th className="px-4 py-1.5 font-medium">Ребёнок</th>
            <th className="px-4 py-1.5 text-right font-medium">Раз</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => (
            <tr
              key={r.user_id}
              className="border-t border-[var(--color-border)]"
            >
              <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                {i + 1}
              </td>
              <td className="px-4 py-1.5">
                {r.l_name} {r.f_name} {r.m_name ?? ""}
              </td>
              <td className="px-4 py-1.5 text-right font-semibold text-[var(--color-brand)]">
                {r.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
