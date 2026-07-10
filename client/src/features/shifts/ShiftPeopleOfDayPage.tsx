import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { shiftsApi } from "./shifts-api";
import type { ShiftPeopleOfDay, WinnerPerson } from "./types";

// Person-of-day log: one block per shift, each day with the child(ren) named
// person of the day — tied to a day number, date and shift. Newest first.
export function ShiftPeopleOfDayPage() {
  const [board, setBoard] = useState<ShiftPeopleOfDay[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    shiftsApi
      .peopleOfDay()
      .then((b) => active && setBoard(b))
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
  if (!board) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const total = board.reduce((n, s) => n + s.days.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">
          Человеки дня ({board.length} смен · {total} дней)
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          По дням из архива смен. Смены без поденных данных здесь не показаны.
        </p>
      </div>

      {board.map((s) => (
        <div
          key={s.shift_id}
          className="bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-[var(--color-border)] px-4 py-2.5">
            <Link
              to={`/admin/shifts/${s.shift_id}`}
              className="text-sm font-semibold text-[var(--color-brand)]"
            >
              Смена {s.shift_id}
            </Link>
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              {s.days.map((d) => (
                <tr
                  key={d.day_number}
                  className="border-t border-[var(--color-border)] first:border-t-0"
                >
                  <td className="w-16 px-4 py-1.5 text-[var(--color-text-muted)]">
                    День {d.day_number}
                  </td>
                  <td className="w-28 px-2 py-1.5 text-[var(--color-text-muted)]">
                    {d.date}
                  </td>
                  <td className="px-2 py-1.5">
                    {d.people.map(fullName).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function fullName(p: WinnerPerson): string {
  return [p.l_name, p.f_name, p.m_name].filter(Boolean).join(" ");
}
