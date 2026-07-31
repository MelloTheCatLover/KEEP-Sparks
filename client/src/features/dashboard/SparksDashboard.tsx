import { ACHIEVEMENT_COLUMNS } from "../sparks/columns";
import type { MyBreakdown, MyShiftStat } from "../sparks/types";
import { KtbTeamCard } from "./KtbTeamCard";
import { LiveShiftCard } from "./LiveShiftCard";
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

// Shared read-only stats view — used by the child's own home page and by the
// admin viewing a child's page.
export function SparksDashboard({
  data,
  onReveal,
}: {
  data: MyBreakdown;
  onReveal?: () => void;
}) {
  const totalAchievements = Object.values(data.totals).reduce(
    (s, v) => s + v,
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Сундук с составами КТБ — самое верхнее: это событие дня, а не сводка. */}
      {data.ktb && (
        <KtbTeamCard
          ktb={data.ktb}
          onReveal={onReveal ?? (() => {})}
          onOpened={onReveal ?? (() => {})}
        />
      )}
      {data.live && (
        <LiveShiftCard
          live={data.live}
          onProgress={onReveal ?? (() => {})}
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Всего искр">
          <span className="text-2xl font-bold text-[var(--color-brand)]">
            {data.summary.sparks.toLocaleString("ru-RU")}
          </span>
          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
            {sparksWord(data.summary.sparks)}
          </span>
        </Tile>
        <Tile label="Общий рейтинг">
          <span className="text-2xl font-bold">#{data.summary.rank}</span>
          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
            из {data.summary.total}
          </span>
        </Tile>
        <Tile label="Текущий рейтинг">
          {data.current ? (
            <>
              <span className="text-2xl font-bold">#{data.current.rank}</span>
              <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                из {data.current.total}
              </span>
            </>
          ) : (
            <span className="text-sm text-[var(--color-text-muted)]">
              не участвует
            </span>
          )}
        </Tile>
        <Tile label="Смен пройдено">
          <span className="text-2xl font-bold">{data.shifts.length}</span>
        </Tile>
        <Tile label="Достижений">
          <span className="text-2xl font-bold">{totalAchievements}</span>
        </Tile>
      </div>

      {data.bonuses.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-brand)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--color-border)] px-4 py-2.5">
            <h2 className="text-sm font-semibold">✨ Бонусы</h2>
          </div>
          <div className="flex flex-col">
            {data.bonuses.map((b) => (
              <div
                key={b.id}
                className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] px-4 py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <span className="font-medium">{b.reason ?? "Бонус"}</span>
                  <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                    {b.created_at.slice(0, 10)}
                  </span>
                </div>
                <span className="shrink-0 font-semibold text-[var(--color-brand)]">
                  +{b.amount.toLocaleString("ru-RU")} {sparksWord(b.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          {data.shifts.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
              Пока нет смен в рейтинге.
            </p>
          ) : (
            [...data.shifts].reverse().map((s) => <ShiftRow key={s.shift_id} s={s} />)
          )}
        </div>
      </div>
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
