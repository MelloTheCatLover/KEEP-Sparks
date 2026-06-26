import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { shiftsApi } from "./shifts-api";
import type { ShiftSummary } from "./types";

// Person of the shift (Человек смены) per shift, newest first.
export function PeopleOfShiftPage() {
  const [shifts, setShifts] = useState<ShiftSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    shiftsApi
      .list()
      .then((s) => active && setShifts(s))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">Не удалось загрузить смены.</div>
    );
  }
  if (!shifts) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const sorted = [...shifts].sort((a, b) => b.shift_id - a.shift_id);

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Человеки смен ({shifts.length})</h2>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="px-4 py-1.5 font-medium">Смена</th>
            <th className="px-4 py-1.5 font-medium">Название</th>
            <th className="px-4 py-1.5 font-medium">Человек смены</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={s.shift_id}
              className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg)]"
            >
              <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                <Link
                  to={`/admin/shifts/${s.shift_id}`}
                  className="text-[var(--color-brand)]"
                >
                  {s.shift_id}
                </Link>
              </td>
              <td className="px-4 py-1.5">{s.name ?? "—"}</td>
              <td className="px-4 py-1.5">
                {s.person_l_name ? (
                  `${s.person_l_name} ${s.person_f_name ?? ""} ${s.person_m_name ?? ""}`
                ) : (
                  <span className="text-[var(--color-text-muted)] opacity-50">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
