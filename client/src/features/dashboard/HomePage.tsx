import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";
import { sparksApi } from "../sparks/sparks-api";
import { ACHIEVEMENT_COLUMNS } from "../sparks/columns";
import type { MyBreakdown, MyShiftStat } from "../sparks/types";
import { SparksChart } from "./SparksChart";

// Russian plural for "искра": 1 искра, 2 искры, 5 искр.
function sparksWord(n: number): string {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return "искр";
  if (m10 === 1) return "искра";
  if (m10 >= 2 && m10 <= 4) return "искры";
  return "искр";
}

const LABEL = new Map(ACHIEVEMENT_COLUMNS.map((c) => [c.key, c.full]));
const ORDER = new Map(ACHIEVEMENT_COLUMNS.map((c, i) => [c.key, i]));

export function HomePage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<MyBreakdown | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "child") return;
    let active = true;
    sparksApi
      .myBreakdown()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;
  if (user.role === "admin") return <Navigate to="/admin" replace />;

  const totalAchievements = data
    ? Object.values(data.totals).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Искры</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Привет, {user.f_name}!
          </p>
        </div>
        <Button onClick={logout} className="px-3 py-1.5 text-sm">
          Выйти
        </Button>
      </header>

      {error && (
        <div className="text-[var(--color-danger)]">
          Не удалось загрузить статистику.
        </div>
      )}
      {!error && !data && (
        <div className="text-[var(--color-text-muted)]">Загрузка…</div>
      )}

      {data && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Всего искр">
              <span className="text-2xl font-bold text-[var(--color-brand)]">
                {data.summary.sparks.toLocaleString("ru-RU")}
              </span>
              <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                {sparksWord(data.summary.sparks)}
              </span>
            </Tile>
            <Tile label="Место в рейтинге">
              <span className="text-2xl font-bold">#{data.summary.rank}</span>
              <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                из {data.summary.total}
              </span>
            </Tile>
            <Tile label="Смен пройдено">
              <span className="text-2xl font-bold">{data.shifts.length}</span>
            </Tile>
            <Tile label="Достижений">
              <span className="text-2xl font-bold">{totalAchievements}</span>
            </Tile>
          </div>

          {data.shifts.length >= 2 && (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-2 text-sm font-semibold">Искры по сменам</h2>
              <SparksChart shifts={data.shifts} />
            </div>
          )}

          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--color-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">По сменам</h2>
            </div>
            <div className="flex flex-col">
              {[...data.shifts].reverse().map((s) => (
                <ShiftRow key={s.shift_id} s={s} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <p className="mb-1 text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <div className="leading-none">{children}</div>
    </div>
  );
}

function ShiftRow({ s }: { s: MyShiftStat }) {
  const badges = Object.entries(s.counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => (ORDER.get(a[0]) ?? 99) - (ORDER.get(b[0]) ?? 99));

  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] px-4 py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="font-medium">Смена {s.shift_id}</span>
          {s.name && (
            <span className="ml-1.5 text-sm text-[var(--color-text-muted)]">
              {s.name}
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="font-semibold text-[var(--color-brand)]">
            {s.sparks.toLocaleString("ru-RU")}
          </span>
          <span className="ml-1 text-xs text-[var(--color-text-muted)]">искр</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
        <span>
          {s.start_date} – {s.end_date}
        </span>
        <span>
          место {s.rank} из {s.shift_total}
        </span>
      </div>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {badges.map(([key, v]) => (
            <span
              key={key}
              className="rounded-[var(--radius-sm)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-muted)]"
            >
              {LABEL.get(key) ?? key}
              {v > 1 ? ` ×${v}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
