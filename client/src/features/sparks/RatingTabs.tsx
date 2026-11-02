import type { RatingMode } from "./rating-mode";
import { seasonLabel } from "./rating-mode";
import type { SeasonsInfo } from "./types";

// Переключатель рейтинга: сезон (текущий), текущий, общий — в заданном
// порядке, и список прошлых сезонов, если они есть.
export function RatingTabs({
  mode,
  onChange,
  seasons,
  order,
}: {
  mode: RatingMode;
  onChange: (m: RatingMode) => void;
  seasons: SeasonsInfo | null;
  order: ("season" | "current" | "overall")[];
}) {
  const current = seasons?.current ?? null;
  const past = (seasons?.seasons ?? []).filter((s) => s.season !== current);
  const isPast = typeof mode === "number" && mode !== current;

  const tab = (id: RatingMode, label: string) => (
    <button
      key={String(id)}
      onClick={() => onChange(id)}
      className={
        "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm " +
        (mode === id
          ? "bg-[var(--color-brand)] text-white"
          : "bg-[var(--color-surface)] text-[var(--color-text-muted)]")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {order.map((o) => {
        if (o === "season") {
          return current === null
            ? null
            : tab(current, `Сезон ${seasonLabel(current)}`);
        }
        return o === "current" ? tab("current", "Текущий") : tab("overall", "Общий");
      })}
      {past.length > 0 && (
        <select
          value={isPast ? String(mode) : ""}
          onChange={(e) => e.target.value && onChange(Number(e.target.value))}
          className={
            "rounded-[var(--radius-sm)] px-2 py-1.5 text-sm " +
            (isPast
              ? "bg-[var(--color-brand)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)]")
          }
          aria-label="Прошлые сезоны"
        >
          <option value="">Прошлые сезоны</option>
          {past.map((s) => (
            <option key={s.season} value={s.season}>
              {s.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
