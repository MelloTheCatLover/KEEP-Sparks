import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { downloadSheet } from "../../shared/xlsx";
import { ACHIEVEMENT_COLUMNS } from "../sparks/columns";
import { shiftsApi } from "./shifts-api";
import type { ShiftAchievementsGrid, ShiftDetail } from "./types";

export function ShiftDetailPage() {
  const { id } = useParams();
  const shiftId = Number(id);
  const validId = Number.isInteger(shiftId);
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [grid, setGrid] = useState<ShiftAchievementsGrid | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!validId) return;
    let active = true;
    Promise.all([shiftsApi.detail(shiftId), shiftsApi.achievements(shiftId)])
      .then(([s, g]) => {
        if (!active) return;
        setShift(s);
        setGrid(g);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [shiftId, validId]);

  if (error || !validId) {
    return <div className="text-[var(--color-danger)]">Смена не найдена.</div>;
  }
  if (!shift || !grid) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const fio = (r: { l_name: string; f_name: string; m_name: string | null }) =>
    `${r.l_name} ${r.f_name} ${r.m_name ?? ""}`.trim();

  // Short: exactly what the on-screen ranking shows.
  function exportShort() {
    const rows = shift!.ranking.map((r) => ({
      "#": r.rank,
      ФИО: fio(r),
      Логин: r.login,
      Искры: r.sparks,
    }));
    downloadSheet(`смена-${shift!.shift_id}-кратко.xlsx`, "Рейтинг", rows);
  }

  // Wide: one row per child with the full achievement breakdown, ordered by
  // rank. Counts come from the grid, joined to the ranking by user_id.
  function exportWide() {
    const counts = new Map(grid!.members.map((m) => [m.user_id, m.counts]));
    const rows = shift!.ranking.map((r) => {
      const c = counts.get(r.user_id) ?? {};
      const row: Record<string, string | number> = {
        "#": r.rank,
        ФИО: fio(r),
        Искры: r.sparks,
      };
      for (const col of ACHIEVEMENT_COLUMNS) row[col.full] = c[col.key] ?? 0;
      return row;
    });
    downloadSheet(`смена-${shift!.shift_id}-широко.xlsx`, "Достижения", rows);
  }

  return (
    <div className="flex flex-col gap-3">
      <Link to="/admin/shifts" className="text-sm text-[var(--color-brand)]">
        ← Все смены
      </Link>

      <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <div>
          <h2 className="text-base font-semibold">
            {shift.shift_id} · {shift.name ?? "—"}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {shift.start_date} – {shift.end_date} · детей: {shift.child_count} ·
            коэффициент: {shift.difficulty}
          </p>
        </div>
        <Link
          to={`/admin/shifts/${shift.shift_id}/edit`}
          className="shrink-0 text-sm text-[var(--color-brand)]"
        >
          Редактировать
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
          <h3 className="text-sm font-semibold">Рейтинг смены</h3>
          <div className="flex items-center gap-2">
            <Button onClick={exportShort} className="px-2.5 py-1 text-xs">
              Скачать кратко
            </Button>
            <Button onClick={exportWide} className="px-2.5 py-1 text-xs">
              Скачать широко
            </Button>
          </div>
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
