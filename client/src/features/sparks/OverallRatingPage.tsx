import { useEffect, useState } from "react";
import { sparksApi } from "./sparks-api";
import type { OverviewEntry } from "./types";

// Achievement columns, in catalogue order. `short` is the compact header; the
// full name shows on hover. Mirrors the old "Общий Рейтинг" sheet, but every
// action gets its own column instead of a few summary ones.
const COLUMNS: { key: string; short: string; full: string }[] = [
  { key: "reality_winner", short: "Поб", full: "Реалити: победа" },
  { key: "reality_super_finalist", short: "Суф", full: "Реалити: супер-финал" },
  { key: "reality_finalist", short: "Фин", full: "Реалити: финал" },
  { key: "reality_plot", short: "Сюж", full: "Реалити: сюжет" },
  { key: "reality_leader", short: "Лид", full: "Реалити: лучший / лидер" },
  { key: "stars_winner", short: "★Поб", full: "Звёзды: победа" },
  { key: "stars_finalist", short: "★Фин", full: "Звёзды: финал" },
  { key: "ktb_winner", short: "КТБп", full: "КТБ: победа" },
  { key: "ktb_stage", short: "КТБэ", full: "КТБ: этап" },
  { key: "ktb_team_best", short: "КТБл", full: "КТБ: лучший в команде" },
  { key: "kgg_winner", short: "КГГп", full: "КГГ: победа" },
  { key: "kgg_mvp", short: "КГГм", full: "КГГ: лучший из лучших" },
  { key: "kgg_cup", short: "Куб", full: "КГГ: кубок" },
  { key: "person_of_shift", short: "ЧСм", full: "Человек смены" },
  { key: "person_of_day", short: "ЧДн", full: "Человек дня" },
  { key: "recognition", short: "Прз", full: "Признание руководителя" },
  { key: "day", short: "Дни", full: "Дней присутствия" },
];

export function OverallRatingPage() {
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
        Не удалось загрузить общий рейтинг.
      </div>
    );
  }
  if (!rows) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Общий рейтинг</h2>
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
                className="border-t border-[var(--color-border)]"
              >
                <td className="px-3 py-1.5 text-[var(--color-text-muted)]">
                  {r.rank}
                </td>
                <td className="px-3 py-1.5">
                  {r.l_name} {r.f_name} {r.m_name ?? ""}
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
  );
}
