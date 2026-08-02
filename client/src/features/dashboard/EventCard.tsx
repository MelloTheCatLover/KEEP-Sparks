import { useEffect, useRef, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { sparksApi } from "../sparks/sparks-api";
import type { EventBoardEntry, MyEvent } from "../sparks/types";
import "./ktb-reveal.css";

const BURST_MS = 950; // столько крутится сундук, прежде чем показать число

// Сундук розыгрыша: число приходит только в ответе на открытие, поэтому
// анимация ждёт сервер, в отличие от сундука КТБ.
function PrizeChest({
  event,
  onOpened,
}: {
  event: MyEvent;
  onOpened: (next: MyEvent | null) => void;
}) {
  const [phase, setPhase] = useState<"closed" | "burst" | "done">("closed");
  const [amount, setAmount] = useState<number | null>(event.prize?.amount ?? null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function open(): void {
    setPhase("burst");
    sparksApi
      .openEventPrize()
      .then((next) => {
        setAmount(next?.prize?.amount ?? null);
        timer.current = window.setTimeout(() => {
          setPhase("done");
          onOpened(next);
        }, BURST_MS);
      })
      .catch(() => setPhase("closed"));
  }

  if (event.prize?.opened || phase === "done") {
    return (
      <div className="border-t border-[var(--color-border)] px-4 py-3 text-center">
        <div className="text-[13px] text-[var(--color-text-muted)]">
          🎁 Подарок лагеря
        </div>
        <div className="mt-1 text-3xl font-bold text-[var(--color-brand)]">
          +{(amount ?? 0).toLocaleString("ru-RU")}
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">искр</div>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--color-border)] px-4 py-3 text-center">
      <div className="text-base font-semibold">🎁 Подарок ждёт тебя</div>
      <div className="ktb-stage mt-2">
        <span
          className={"ktb-chest" + (phase === "burst" ? " ktb-chest--burst" : "")}
          aria-hidden
        >
          🎁
        </span>
      </div>
      {phase === "closed" ? (
        <Button onClick={open} className="mt-1 px-5 py-2">
          Открыть подарок
        </Button>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          открываем…
        </p>
      )}
    </div>
  );
}

// Доска праздника: место среди участников дня рождения. Открывается по
// нажатию — на дашборде и без неё хватает карточек.
function EventLeaderboard({ sparks }: { sparks: number }) {
  const [rows, setRows] = useState<EventBoardEntry[] | null>(null);
  const [open, setOpen] = useState(false);

  // Догружается при первом раскрытии и после каждой смены счёта: открыл
  // сундук — место поехало.
  useEffect(() => {
    if (!open) return;
    let active = true;
    sparksApi
      .eventBoard()
      .then((r) => active && setRows(r))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, [open, sparks]);

  return (
    <div className="border-t border-[var(--color-border)] px-4 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[13px] text-[var(--color-brand)]"
      >
        {open ? "скрыть рейтинг праздника" : "рейтинг праздника"}
      </button>
      {open && rows && rows.length > 0 && (
        <div className="mt-2 flex flex-col">
          {rows.map((r) => (
            <div
              key={r.user_id}
              className={
                "flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-1 text-[13px] last:border-b-0 " +
                (r.is_me ? "font-semibold text-[var(--color-brand)]" : "")
              }
            >
              <span>
                {r.rank}. {r.l_name} {r.f_name}
              </span>
              <span className="shrink-0">{r.sparks.toLocaleString("ru-RU")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// День рождения лагеря в кабинете ребёнка: за что и сколько досталось на
// празднике. Приходят только объявленные награды — неопубликованных нет в
// ответе сервера вовсе.
export function EventCard({
  event,
  onOpened,
}: {
  event: MyEvent;
  onOpened: (next: MyEvent | null) => void;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border-2 border-[var(--color-brand)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          🎂 {event.name ?? "День рождения лагеря"}
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {event.start_date}
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="text-xs text-[var(--color-text-muted)]">
          Искр за праздник
        </div>
        <span className="text-2xl font-bold text-[var(--color-brand)]">
          {event.sparks.toLocaleString("ru-RU")}
        </span>
      </div>

      {event.prize?.drawn && <PrizeChest event={event} onOpened={onOpened} />}

      {event.awards.length === 0 ? (
        <p className="border-t border-[var(--color-border)] px-4 py-2.5 text-[13px] text-[var(--color-text-muted)]">
          Награды появятся здесь, как только их объявят.
        </p>
      ) : (
        <div className="flex flex-col border-t border-[var(--color-border)]">
          {event.awards.map((a) => (
            <div
              key={a.id}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2 text-[13px] last:border-b-0"
            >
              <span>{a.title}</span>
              <span className="shrink-0 font-semibold text-[var(--color-brand)]">
                {a.amount > 0 ? "+" : ""}
                {a.amount.toLocaleString("ru-RU")}
              </span>
            </div>
          ))}
        </div>
      )}

      <EventLeaderboard sparks={event.sparks} />
    </div>
  );
}
