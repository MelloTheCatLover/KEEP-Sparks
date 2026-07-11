import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { sparksApi } from "../sparks/sparks-api";
import type { BoardEntry } from "../sparks/types";

// Public sparks board for children: Фамилия Имя — Искры, by rank. Toggle
// between the overall and current ranking. Read-only.
export function SparksBoardPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"overall" | "current">("overall");
  // Tag the loaded rows with their mode so a mode switch shows loading again
  // without a synchronous reset inside the effect.
  const [state, setState] = useState<{
    mode: "overall" | "current";
    rows: BoardEntry[];
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    sparksApi
      .board(mode)
      .then((r) => {
        if (active) {
          setState({ mode, rows: r });
          setError(false);
        }
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [mode]);

  const rows = state && state.mode === mode ? state.rows : null;

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

  return (
    <div className="flex flex-col gap-3">
      {tabs}
      {error && (
        <div className="text-[var(--color-danger)]">
          Не удалось загрузить рейтинг.
        </div>
      )}
      {!error && !rows && (
        <div className="text-[var(--color-text-muted)]">Загрузка…</div>
      )}
      {rows && (
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <h2 className="text-sm font-semibold">
              {mode === "current" ? "Текущий рейтинг" : "Общий рейтинг"}
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {rows.length}
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)]">
                <th className="px-4 py-1.5 font-medium">#</th>
                <th className="px-4 py-1.5 font-medium">Фамилия Имя</th>
                <th className="px-4 py-1.5 text-right font-medium">Искры</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.user_id}
                  className={
                    "border-t border-[var(--color-border)]" +
                    (r.user_id === user?.id
                      ? " bg-[var(--color-bg)] font-semibold"
                      : "")
                  }
                >
                  <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                    {r.rank}
                  </td>
                  <td className="px-4 py-1.5">
                    {r.l_name} {r.f_name}
                  </td>
                  <td className="px-4 py-1.5 text-right font-semibold text-[var(--color-brand)]">
                    {r.sparks.toLocaleString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
