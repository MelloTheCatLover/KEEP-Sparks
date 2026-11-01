import { useEffect, useState } from "react";
import { analyticsApi } from "./analytics-api";
import { RankCurve } from "./RankCurve";
import { RankTerrain } from "./RankTerrain";
import type { RankTrajectories } from "./types";

const LIMITS = [
  { value: 0, label: "все" },
  { value: 200, label: "топ-200" },
  { value: 100, label: "топ-100" },
  { value: 50, label: "топ-50" },
];

// Места и искры: кривая «место → искры» и 3D-карта, где к ним добавлено время.
// Данные отдельным запросом: страница наград не ждёт траекторий, и наоборот.
export function PlacesSection() {
  const [data, setData] = useState<RankTrajectories | null>(null);
  const [error, setError] = useState(false);
  const [log, setLog] = useState(false);
  const [limit, setLimit] = useState(0);

  useEffect(() => {
    let active = true;
    analyticsApi
      .trajectories()
      .then((r) => active && setData(r))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  const kids = data
    ? limit > 0
      ? data.children.slice(0, limit)
      : data.children
    : [];

  return (
    <div className="overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
        <div>
          <h3 className="text-sm font-semibold">Участники по местам</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            Общий рейтинг: место и искры. Ниже — как к этим искрам шли по
            сменам.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <div className="flex gap-1">
            {LIMITS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLimit(l.value)}
                className={
                  "rounded-[var(--radius-sm)] px-2 py-0.5 " +
                  (limit === l.value
                    ? "bg-[var(--color-brand)] text-[var(--color-brand-text)]"
                    : "bg-[var(--color-bg)] text-[var(--color-text-muted)]")
                }
              >
                {l.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1 text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={log}
              onChange={(e) => setLog(e.target.checked)}
            />
            лог. шкала
          </label>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 text-[13px] text-[var(--color-danger)]">
          Не удалось загрузить места.
        </div>
      )}
      {!data && !error && (
        <div className="px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Считаю…
        </div>
      )}
      {data && (
        <div className="flex flex-col gap-3 px-4 py-3">
          <RankCurve kids={kids} log={log} />
          <div>
            <h4 className="text-[13px] font-semibold">
              3D-карта: место × искры × время
            </h4>
            <p className="mb-1 text-[11px] text-[var(--color-text-muted)]">
              Каждый срез вглубь — рейтинг после очередной смены (
              {data.shifts.length} смен по дате): места на тот момент и
              искры. Под курсором — путь ребёнка по местам. Тяните, чтобы
              повернуть; наведите или коснитесь поверхности.
            </p>
            <RankTerrain
              kids={data.children}
              shifts={data.shifts}
              places={limit > 0 ? limit : data.children.length}
              log={log}
            />
          </div>
        </div>
      )}
    </div>
  );
}
