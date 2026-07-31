import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { fio } from "./PeoplePicker";
import type { KtbDraftPlan, LiveBoard, TeamInput } from "./live-types";

const TIER_LABEL: Record<string, string> = {
  best: "Лучшие в команде",
  winner: "Победители КТБ",
  member: "Участники",
  rookie: "Новенькие",
};

// Название по умолчанию — номер: у КТБ команды обычно нумеруют, а не называют.
function defaultNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Команда ${i + 1}`);
}

// Подготовка составов КТБ: админ задаёт команды, система разводит по ним весь
// ростер (лучшие → победители → участники → новенькие, внутри группы по искрам),
// показывает план, и только по кнопке он уходит в базу.
//
// План не пересчитывается при сохранении: равные искры разрываются случайно, и
// повторный расчёт дал бы другую раскладку, а не ту, которую админ утвердил.
export function KtbDraftPanel({
  board,
  onPlan,
  onSave,
  onSetReveal,
}: {
  board: LiveBoard;
  onPlan: (names: string[]) => Promise<KtbDraftPlan>;
  onSave: (teams: TeamInput[]) => Promise<void>;
  onSetReveal: (revealAt: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  // Если составы уже сохранены, панель начинает с их названий: пересчёт по смыслу
  // почти всегда — «те же команды, другая раскладка».
  const [names, setNames] = useState<string[]>(() =>
    board.teams.ktb.length >= 2
      ? board.teams.ktb.map((t) => t.name)
      : defaultNames(4),
  );
  const [plan, setPlan] = useState<KtbDraftPlan | null>(null);
  const [revealAt, setRevealAt] = useState(board.ktb_reveal_local ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Сохранение почти ничего не меняет на экране: составы уезжают в блок
  // «Команды» ниже, а сама панель выглядит как прежде. Без явной отметки это
  // читается как «кнопка не сработала».
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRevealAt(board.ktb_reveal_local ?? "");
  }, [board.ktb_reveal_local]);

  const byId = new Map(board.members.map((m) => [m.user_id, m]));
  const name = (id: string): string => {
    const m = byId.get(id);
    return m ? fio(m) : id;
  };

  async function calc(): Promise<void> {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      setPlan(await onPlan(names));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось рассчитать составы.");
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    if (!plan) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(
        plan.teams.map((t) => ({ name: t.name, member_ids: t.member_ids })),
      );
      // План остаётся на экране: админ должен видеть, что именно ушло в базу.
      setSaved(true);
    } catch {
      setErr("Не удалось сохранить составы.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReveal(clear = false): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await onSetReveal(clear ? null : revealAt || null);
    } catch {
      setErr("Не удалось сохранить время раскрытия.");
    } finally {
      setBusy(false);
    }
  }

  const tiers = plan
    ? Object.entries(
        plan.candidates.reduce<Record<string, number>>((acc, c) => {
          acc[c.tier] = (acc[c.tier] ?? 0) + 1;
          return acc;
        }, {}),
      )
    : [];

  return (
    <div className="flex flex-col gap-3 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Подготовить команды КТБ</h3>
        <Button onClick={() => setOpen(!open)} className="px-3 py-1 text-xs">
          {open ? "Свернуть" : "Раздать составы"}
        </Button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Раздача идёт группами: сначала расходятся бывшие лучшие в команде, потом
        победители КТБ, потом остальные бывалые, новенькие — последними. Каждая
        группа расходится по командам поровну, а суммы искр система доводит
        обменами внутри группы.
      </p>

      {open && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px]">Команд:</span>
              <input
                type="number"
                min={2}
                max={32}
                value={names.length}
                onChange={(e) => {
                  const n = Math.max(2, Math.min(32, Number(e.target.value) || 2));
                  setNames((prev) =>
                    Array.from(
                      { length: n },
                      (_, i) => prev[i] ?? `Команда ${i + 1}`,
                    ),
                  );
                }}
                className="w-16 border border-[var(--color-border)] px-2 py-1 text-[13px]"
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                детей: {board.members.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {names.map((n, i) => (
                <input
                  key={i}
                  value={n}
                  onChange={(e) =>
                    setNames(names.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder={`Команда ${i + 1}`}
                  className="w-40 border border-[var(--color-border)] px-2 py-1 text-[13px]"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={calc} disabled={busy} className="px-3 py-1 text-xs">
              Рассчитать составы
            </Button>
            {plan && (
              <Button
                onClick={save}
                disabled={busy || saved}
                className="px-3 py-1 text-xs"
              >
                {saved ? "Составы сохранены" : "Сохранить составы"}
              </Button>
            )}
            {saved && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Составы в базе — ниже, в блоке «Команды».
              </span>
            )}
            {plan && !saved && board.teams.ktb.length > 0 && (
              <span className="text-xs text-[var(--color-danger)]">
                Сохранение заменит текущие составы КТБ: команды создаются заново,
                баллы этапов и выбранный победитель обнулятся.
              </span>
            )}
            {plan && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {tiers
                  .map(([t, n]) => `${TIER_LABEL[t] ?? t}: ${n}`)
                  .join(" · ")}
              </span>
            )}
          </div>

          {plan && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plan.teams.map((t, i) => (
                <div
                  key={i}
                  className="border border-[var(--color-border)] p-2 text-[13px]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t.member_ids.length} чел. ·{" "}
                      {t.sparks.toLocaleString("ru-RU")} искр
                    </span>
                  </div>
                  <ul className="mt-1 flex flex-col">
                    {t.member_ids.map((id) => {
                      const c = plan.candidates.find((x) => x.user_id === id);
                      return (
                        <li
                          key={id}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span>{name(id)}</span>
                          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                            {c ? TIER_LABEL[c.tier] : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px]">Дети узнают команды:</span>
          <input
            type="datetime-local"
            value={revealAt}
            onChange={(e) => setRevealAt(e.target.value)}
            className="border border-[var(--color-border)] px-2 py-1 text-[13px]"
          />
          <Button
            onClick={() => saveReveal()}
            disabled={busy}
            className="px-3 py-1 text-xs"
          >
            Сохранить время
          </Button>
          {board.ktb_reveal_at && (
            <button
              onClick={() => saveReveal(true)}
              disabled={busy}
              className="text-xs text-[var(--color-danger)]"
            >
              Убрать
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Время лагерное. Пока оно не задано, ребёнок не видит ни отсчёта, ни
          команды. Двигать можно сколько угодно — в том числе назад.
          {board.ktb_reveal_at &&
            ` Уже открыли сундук: ${board.ktb_opened_count} из ${board.members.length}.`}
        </p>
      </div>

      {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}
    </div>
  );
}
