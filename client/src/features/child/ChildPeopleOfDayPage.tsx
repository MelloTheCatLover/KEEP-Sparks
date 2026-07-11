import { useEffect, useState } from "react";
import { shiftsApi } from "../shifts/shifts-api";
import type { PersonOfDayEntry, WinnerPerson } from "../shifts/types";

// Read-only "Человек дня" log for children, ordered by day number like the
// source table. Some days name two people. No links into the admin area.
export function ChildPeopleOfDayPage() {
  const [days, setDays] = useState<PersonOfDayEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    shiftsApi
      .peopleOfDay()
      .then((d) => active && setDays(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить человеков дня.
      </div>
    );
  }
  if (!days) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Человек дня ({days.length})</h2>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="px-4 py-1.5 font-medium">День</th>
            <th className="px-4 py-1.5 font-medium">ФИО</th>
            <th className="px-4 py-1.5 font-medium">Дата</th>
            <th className="px-4 py-1.5 text-right font-medium">Смена</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr
              key={`${d.day_number}-${d.shift_id}`}
              className="border-t border-[var(--color-border)]"
            >
              <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                {d.day_number}
              </td>
              <td className="px-4 py-1.5">
                {d.people.map(fullName).join(", ")}
              </td>
              <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                {d.date}
              </td>
              <td className="px-4 py-1.5 text-right text-[var(--color-text-muted)]">
                {d.shift_id}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fullName(p: WinnerPerson): string {
  return [p.l_name, p.f_name, p.m_name].filter(Boolean).join(" ");
}
