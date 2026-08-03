import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { ACHIEVEMENT_COLUMNS } from "../sparks/columns";
import { sparksApi } from "../sparks/sparks-api";
import type { LiveDay, LiveShiftProgress } from "../sparks/types";

const LABEL = new Map(ACHIEVEMENT_COLUMNS.map((c) => [c.key, c.full]));

// Нераскрытая карточка: ребёнок видит, что искры пришли, но не сколько —
// число появляется по нажатию.
function PendingCard({
  day,
  shiftId,
  onOpened,
}: {
  day: LiveDay;
  shiftId: number;
  onOpened: (p: LiveShiftProgress | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);

  async function open(): Promise<void> {
    setBusy(true);
    try {
      const next = await sparksApi.openLiveDay(shiftId, day.day_number);
      setOpened(true);
      onOpened(next);
    } finally {
      setBusy(false);
    }
  }

  if (!opened) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[var(--color-brand)] bg-[var(--color-surface)] p-4 text-center shadow-[var(--shadow-card)]">
        <div className="text-base font-semibold">✨ Твои искры за вчера</div>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          День {day.day_number} · {day.date}
        </p>
        <Button onClick={open} disabled={busy} className="mt-3 px-5 py-2">
          {busy ? "Открываем…" : "Открыть"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[var(--color-brand)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="text-center">
        <div className="text-[13px] text-[var(--color-text-muted)]">
          День {day.day_number} · {day.date}
        </div>
        <div className="mt-1 text-3xl font-bold text-[var(--color-brand)]">
          +{day.delta.toLocaleString("ru-RU")}
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">искр</div>
      </div>
      {day.items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {day.items.map((it) => (
            <li
              key={it.key}
              className="flex items-center justify-between gap-3 text-[13px]"
            >
              <span>{LABEL.get(it.key) ?? it.key}</span>
              {it.amount > 1 && (
                <span className="text-[var(--color-text-muted)]">
                  ×{it.amount}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Один прошедший день: по нажатию раскрывается, за что пришли искры. Сумм по
// пунктам нет намеренно — коэффициент смены накладывается на день целиком, и
// пункты не сложились бы в показанный прирост.
function DayRow({ day }: { day: LiveDay }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-1.5 text-left text-[13px]"
      >
        <span>
          День {day.day_number}
          {day.items.length > 0 && (
            <span className="ml-1.5 text-[var(--color-text-muted)]">
              {open ? "▾" : "▸"}
            </span>
          )}
        </span>
        <span className="text-[var(--color-text-muted)]">{day.date}</span>
        <span className="font-medium">
          {day.delta > 0 ? `+${day.delta.toLocaleString("ru-RU")}` : "—"}
        </span>
      </button>
      {open && day.items.length > 0 && (
        <ul className="flex flex-col gap-1 px-4 pb-2">
          {day.items.map((it) => (
            <li
              key={it.key}
              className="flex items-center justify-between gap-3 text-[12px] text-[var(--color-text-muted)]"
            >
              <span>{LABEL.get(it.key) ?? it.key}</span>
              {it.amount > 1 && <span>×{it.amount}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Текущая смена в кабинете ребёнка: карточка нового дня, накопленный итог и
// история уже открытых дней. Дни, за которые админ ещё не отдал искры, сюда не
// приходят вовсе — их отсекает сервер. Отсчёта до следующих искр нет: момент
// решает админ, заранее он не известен.
export function LiveShiftCard({
  live,
  onProgress,
}: {
  live: LiveShiftProgress;
  onProgress: (p: LiveShiftProgress | null) => void;
}) {
  const history = live.days.filter((d) => d.day_number !== live.pending?.day_number);

  return (
    <div className="flex flex-col gap-3">
      {live.pending && (
        <PendingCard
          day={live.pending}
          shiftId={live.shift_id}
          onOpened={onProgress}
        />
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-brand)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            Смена {live.shift_id}
            {live.name ? ` · ${live.name}` : ""} — идёт сейчас
          </h2>
        </div>

        <div className="flex flex-wrap items-baseline gap-4 px-4 py-3">
          <div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Искр за смену
            </div>
            <span className="text-2xl font-bold text-[var(--color-brand)]">
              {live.sparks.toLocaleString("ru-RU")}
            </span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            открыто дней: {live.days.length} из {live.day_count}
          </div>
        </div>

        {history.length > 0 && (
          <div className="flex flex-col border-t border-[var(--color-border)]">
            {[...history].reverse().map((d) => (
              <DayRow key={d.day_number} day={d} />
            ))}
            <p className="px-4 py-2 text-[11px] text-[var(--color-text-muted)]">
              Искры за день считаются от всей смены сразу и округляются один
              раз, поэтому одинаковые дни иногда отличаются на единицу.
            </p>
          </div>
        )}

        {live.days.length === 0 && (
          <div className="px-4 pb-3 text-[13px] text-[var(--color-text-muted)]">
            Искры за день появятся здесь после подведения итогов.
          </div>
        )}
      </div>
    </div>
  );
}
