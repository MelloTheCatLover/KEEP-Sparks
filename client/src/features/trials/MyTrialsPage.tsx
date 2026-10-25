import { useEffect, useState } from "react";
import { trialsApi } from "./trials-api";
import type { MyTrials } from "./types";

// «Испытания» глазами ребёнка: баллы и место в каждом открытом испытании, итог
// за день, сумма за смену и место в зачёте смены. Пока без оформления — только
// механика.

function pts(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export function MyTrialsPage() {
  // undefined — грузится, null — у смены нет открытых испытаний.
  const [data, setData] = useState<MyTrials | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    trialsApi
      .mine()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить испытания.
      </div>
    );
  }
  if (data === undefined) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }
  if (data === null) {
    return (
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] shadow-[var(--shadow-card)]">
        Результатов испытаний пока нет.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {data.name ?? `Смена ${data.shift_id}`} · все дни
        </p>
        <p className="text-2xl font-semibold">{pts(data.total)} баллов</p>
        <p className="text-sm">
          {data.place} место из {data.participants}
        </p>
      </div>

      {data.days.map((d) => (
        <div
          key={d.day}
          className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <h3 className="text-sm font-semibold">День {d.day}</h3>
            <span className="text-sm">{pts(d.total)} баллов</span>
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              {d.trials.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-2">{t.title}</td>
                  <td className="px-2 py-2 text-right">
                    {t.points === null ? "—" : pts(t.points)}
                  </td>
                  <td className="px-4 py-2 text-right text-[var(--color-text-muted)]">
                    {t.place === null
                      ? "не участвовал(а)"
                      : `${t.place} место из ${t.scored}`}
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
