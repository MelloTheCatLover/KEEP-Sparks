import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { ChildLink } from "../../shared/ui/ChildLink";
import { downloadSheet } from "../../shared/xlsx";
import { ACHIEVEMENT_COLUMNS } from "../sparks/columns";
import { shiftsApi } from "./shifts-api";
import { KTB_LABEL, KTP_LABEL, ktbChip, ktpChip } from "./contest-status";
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
      "№": r.number ?? "",
      ФИО: fio(r),
      Логин: r.login,
      Возраст: r.age ?? "",
      "Статус КТП": KTP_LABEL[r.ktp_status],
      "Статус КТБ": KTB_LABEL[r.ktb_status],
      "Искры до смены": r.sparks_before,
      "Искры за смену": r.sparks,
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
            {shift.average_age != null && ` · средний возраст: ${shift.average_age}`}
            {!shift.in_rating && " · не в рейтинге"}
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
              <th className="px-4 py-1.5 font-medium">№</th>
              <th className="px-4 py-1.5 font-medium">Ребёнок</th>
              <th className="px-4 py-1.5 font-medium">Возраст</th>
              <th className="px-4 py-1.5 font-medium">КТП</th>
              <th className="px-4 py-1.5 font-medium">КТБ</th>
              <th className="px-4 py-1.5 text-right font-medium">Искры до смены</th>
              <th className="px-4 py-1.5 text-right font-medium">Искры за смену</th>
            </tr>
          </thead>
          <tbody>
            {shift.ranking.map((r) => (
              <tr key={r.user_id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-1.5 font-semibold">
                  {r.number ?? "—"}
                </td>
                <td className="px-4 py-1.5">
                  <ChildLink id={r.user_id}>
                    {r.l_name} {r.f_name} {r.m_name ?? ""}
                  </ChildLink>
                  {r.is_new && (
                    <span className="ml-2 rounded-[var(--radius-sm)] border border-[var(--color-brand)] px-1.5 py-0.5 text-[11px] text-[var(--color-brand)]">
                      новенький
                    </span>
                  )}
                </td>
                <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                  {r.age ?? "—"}
                </td>
                <td className="px-4 py-1.5">
                  <span
                    className={`inline-block border px-1.5 py-0.5 text-[11px] ${ktpChip(
                      r.ktp_status,
                    )}`}
                  >
                    {KTP_LABEL[r.ktp_status]}
                  </span>
                </td>
                <td className="px-4 py-1.5">
                  <span
                    className={`inline-block border px-1.5 py-0.5 text-[11px] ${ktbChip(
                      r.ktb_status,
                    )}`}
                  >
                    {KTB_LABEL[r.ktb_status]}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-right text-[var(--color-text-muted)]">
                  {r.sparks_before.toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-1.5 text-right font-semibold text-[var(--color-brand)]">
                  {r.sparks.toLocaleString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StatsTable shift={shift} grid={grid} />
    </div>
  );
}

// Read-only full breakdown: every roster child (in rank order) against every
// achievement column, with a totals row. Same numbers as the editor grid, but
// no editing — the whole picture of a shift at a glance.
function StatsTable({
  shift,
  grid,
}: {
  shift: ShiftDetail;
  grid: ShiftAchievementsGrid;
}) {
  const counts = new Map(grid.members.map((m) => [m.user_id, m.counts]));
  const points = new Map(grid.settings.map((s) => [s.name, s.value]));

  const totals: Record<string, number> = {};
  for (const m of grid.members) {
    for (const col of ACHIEVEMENT_COLUMNS) {
      totals[col.key] = (totals[col.key] ?? 0) + (m.counts[col.key] ?? 0);
    }
  }
  const totalSparks = shift.ranking.reduce((s, r) => s + r.sparks, 0);

  const th =
    "px-2 py-1.5 text-center font-medium text-xs text-[var(--color-text-muted)]";
  const num = "px-2 py-1 text-center tabular-nums";

  return (
    <div className="overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">Полная статистика</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] whitespace-nowrap">
          <thead>
            <tr className="text-left">
              <th className={`${th} sticky left-0 bg-[var(--color-surface)] text-left`}>
                Ребёнок
              </th>
              {ACHIEVEMENT_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={th}
                  title={`${col.full} — ${col.hint} (${points.get(col.key) ?? 0} баллов)`}
                >
                  {col.short}
                </th>
              ))}
              <th className={`${th} text-right`}>Искры</th>
            </tr>
          </thead>
          <tbody>
            {shift.ranking.map((r) => {
              const c = counts.get(r.user_id) ?? {};
              return (
                <tr key={r.user_id} className="border-t border-[var(--color-border)]">
                  <td className="sticky left-0 bg-[var(--color-surface)] px-3 py-1">
                    <ChildLink id={r.user_id}>
                      {r.l_name} {r.f_name} {r.m_name ?? ""}
                    </ChildLink>
                  </td>
                  {ACHIEVEMENT_COLUMNS.map((col) => {
                    const v = c[col.key] ?? 0;
                    return (
                      <td
                        key={col.key}
                        className={`${num} ${v ? "" : "text-[var(--color-text-muted)]"}`}
                      >
                        {v || "·"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1 text-right font-semibold text-[var(--color-brand)]">
                    {r.sparks.toLocaleString("ru-RU")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-border)] font-semibold">
              <td className="sticky left-0 bg-[var(--color-surface)] px-3 py-1.5">
                Итого
              </td>
              {ACHIEVEMENT_COLUMNS.map((col) => (
                <td key={col.key} className={num}>
                  {totals[col.key] || "·"}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right text-[var(--color-brand)]">
                {totalSparks.toLocaleString("ru-RU")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
