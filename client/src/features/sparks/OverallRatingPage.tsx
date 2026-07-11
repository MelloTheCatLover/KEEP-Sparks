import { useEffect, useState } from "react";
import { sparksApi } from "./sparks-api";
import { childrenApi } from "../children/children-api";
import { ACHIEVEMENT_COLUMNS as COLUMNS } from "./columns";
import type { OverviewEntry } from "./types";

export function OverallRatingPage() {
  const [mode, setMode] = useState<"overall" | "current">("overall");
  const [rows, setRows] = useState<OverviewEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setRows(null);
    setError(false);
    sparksApi
      .overview(mode)
      .then((r) => active && setRows(r))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [mode]);

  async function toggleCurrent(id: string, value: boolean) {
    setRows((cur) =>
      cur ? cur.map((r) => (r.user_id === id ? { ...r, in_current_rating: value } : r)) : cur,
    );
    try {
      await childrenApi.setCurrentRating(id, value);
    } catch {
      setRows((cur) =>
        cur
          ? cur.map((r) =>
              r.user_id === id ? { ...r, in_current_rating: !value } : r,
            )
          : cur,
      );
    }
  }

  const tabs = (
    <div className="flex items-center gap-1.5">
      {(
        [
          ["overall", "Общий"],
          ["current", "Текущий"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          className={
            "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm " +
            (mode === id
              ? "bg-[var(--color-brand)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)]")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        {tabs}
        <div className="text-[var(--color-danger)]">
          Не удалось загрузить рейтинг.
        </div>
      </div>
    );
  }
  if (!rows) {
    return (
      <div className="flex flex-col gap-3">
        {tabs}
        <div className="text-[var(--color-text-muted)]">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tabs}
      <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          {mode === "current" ? "Текущий рейтинг" : "Общий рейтинг"}
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-3 py-1.5 font-medium">Ребёнок</th>
              <th className="px-3 py-1.5 font-medium">В текущем</th>
              <th className="px-3 py-1.5 text-right font-medium">Искры</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  title={c.full}
                  className="px-2 py-1.5 text-right font-medium"
                >
                  {c.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.user_id}
                className={
                  "border-t border-[var(--color-border)]" +
                  (r.is_adult || !r.in_current_rating ? " opacity-50" : "")
                }
              >
                <td className="px-3 py-1.5 text-[var(--color-text-muted)]">
                  {r.rank}
                </td>
                <td className="px-3 py-1.5">
                  {r.l_name} {r.f_name} {r.m_name ?? ""}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {r.is_adult ? (
                    <span
                      className="text-xs text-[var(--color-text-muted)]"
                      title="Исключён автоматически: 18+"
                    >
                      18+
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={r.in_current_rating}
                      onChange={(e) => toggleCurrent(r.user_id, e.target.checked)}
                    />
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold text-[var(--color-brand)]">
                  {r.sparks.toLocaleString("ru-RU")}
                </td>
                {COLUMNS.map((c) => {
                  const v = r.counts[c.key] ?? 0;
                  return (
                    <td
                      key={c.key}
                      className={
                        "px-2 py-1.5 text-right " +
                        (v ? "" : "text-[var(--color-text-muted)] opacity-40")
                      }
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
