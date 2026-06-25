import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { shiftsApi } from "./shifts-api";
import type { ShiftDetail } from "./types";

export function ShiftDetailPage() {
  const { id } = useParams();
  const shiftId = Number(id);
  const validId = Number.isInteger(shiftId);
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!validId) return;
    let active = true;
    shiftsApi
      .detail(shiftId)
      .then((s) => active && setShift(s))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [shiftId, validId]);

  if (error || !validId) {
    return <div className="text-[var(--color-danger)]">Смена не найдена.</div>;
  }
  if (!shift) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Link to="/admin/shifts" className="text-sm text-[var(--color-brand)]">
        ← Все смены
      </Link>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">
          {shift.shift_id} · {shift.name ?? "—"}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {shift.start_date} – {shift.end_date} · детей: {shift.child_count} ·
          коэффициент: {shift.difficulty}
        </p>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--color-border)] px-4 py-2.5">
          <h3 className="text-sm font-semibold">Рейтинг смены</h3>
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
            {shift.ranking.map((r) => (
              <tr key={r.user_id} className="border-t border-[var(--color-border)]">
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
