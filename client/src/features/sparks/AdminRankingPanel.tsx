import { useEffect, useState } from "react";
import { sparksApi } from "./sparks-api";
import type { RankingEntry } from "./types";

export function AdminRankingPanel() {
  const [mode, setMode] = useState<"current" | "overall">("current");
  const [rows, setRows] = useState<RankingEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setRows(null);
    setError(false);
    sparksApi
      .ranking(mode)
      .then((r) => {
        if (active) setRows(r);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [mode]);

  const tabs = (
    <div className="flex items-center gap-1.5">
      {(
        [
          ["current", "Текущий"],
          ["overall", "Общий"],
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
        <div className="text-[var(--color-text-muted)]">Загрузка рейтинга…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tabs}
      <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          {mode === "current" ? "Текущий рейтинг детей" : "Общий рейтинг детей"}
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {rows.length}
        </span>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="px-4 py-1.5 font-medium">#</th>
            <th className="px-4 py-1.5 font-medium">Ребёнок</th>
            <th className="px-4 py-1.5 font-medium">Логин</th>
            <th className="px-4 py-1.5 text-right font-medium">Искры</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.user_id}
              className="border-t border-[var(--color-border)]"
            >
              <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                {r.rank}
              </td>
              <td className="px-4 py-1.5">
                {r.l_name} {r.f_name} {r.m_name ?? ""}
              </td>
              <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                {r.login}
              </td>
              <td className="px-4 py-1.5 text-right font-semibold text-[var(--color-brand)]">
                {r.sparks.toLocaleString("ru-RU")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
