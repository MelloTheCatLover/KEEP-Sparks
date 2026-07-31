import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import type { LiveBoard, StageInput } from "./live-types";

interface Draft {
  key: string;
  title: string;
  day: number; // день смены, в который прошёл этап
  scores: Record<number, string>; // строкой, чтобы поле можно было очистить
}

function toDrafts(board: LiveBoard): Draft[] {
  return board.stages.map((s) => ({
    key: `s${s.id}`,
    title: s.title ?? "",
    day: s.day_number,
    scores: Object.fromEntries(
      Object.entries(s.scores).map(([id, p]) => [Number(id), String(p)]),
    ),
  }));
}

// Победитель этапа по введённым баллам — то же правило, что на сервере:
// максимум, при равенстве побеждают все с ним.
function winners(scores: Record<number, string>): number[] {
  const pairs = Object.entries(scores).map(
    ([id, raw]) => [Number(id), Number(raw) || 0] as const,
  );
  const best = Math.max(0, ...pairs.map(([, p]) => p));
  if (best <= 0) return [];
  return pairs.filter(([, p]) => p === best).map(([id]) => id);
}

// Этапы КТБ: у каждого — своя расстановка баллов по командам. Балльная шкала
// у этапов разная, поэтому вводятся сами баллы, а не места; команда с
// наибольшей суммой берёт этап.
//
// Номер этапа не вводится, а равен его месту в списке: этапы двигают стрелками
// и удаляют, номера при этом остаются сплошными 1..N. Ручной ввод номера ломался
// о UNIQUE (shift_id, number) — при перестановке двух этапов в теле запроса на
// миг оказывались два одинаковых, и сохранение падало целиком.
//
// День этапа — отдельно от номера: этапы могут идти не по одному в день, а искры
// за подведённый этап должны уходить вместе с его днём, а не ждать разъезда.
export function StagesPanel({
  board,
  onSave,
}: {
  board: LiveBoard;
  onSave: (stages: StageInput[]) => Promise<void>;
}) {
  const [stages, setStages] = useState<Draft[]>(() => toDrafts(board));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);
  const teams = board.teams.ktb;

  useEffect(() => {
    setStages(toDrafts(board));
  }, [board]);

  // Новый этап заводится на день, который админ ведёт прямо сейчас, — первый
  // ещё не отданный. Отданный день трогать поздно: искры за него уже у детей.
  const currentDay =
    board.days.find((d) => !d.revealed)?.day_number ?? board.day_count;

  function addStage(): void {
    setStages([
      ...stages,
      { key: `new${nextKey}`, title: "", day: currentDay, scores: {} },
    ]);
    setNextKey(nextKey + 1);
  }

  function patch(key: string, fields: Partial<Draft>): void {
    setStages(stages.map((s) => (s.key === key ? { ...s, ...fields } : s)));
  }

  function move(index: number, delta: number): void {
    const to = index + delta;
    if (to < 0 || to >= stages.length) return;
    const next = [...stages];
    [next[index], next[to]] = [next[to], next[index]];
    setStages(next);
  }

  async function save(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await onSave(
        stages.map((s) => ({
          title: s.title.trim() || null,
          day_number: s.day,
          scores: Object.fromEntries(
            Object.entries(s.scores)
              .map(([id, raw]) => [Number(id), Number(raw)] as const)
              .filter(([, p]) => Number.isFinite(p)),
          ),
        })),
      );
    } catch {
      setErr("Не удалось сохранить этапы.");
    } finally {
      setBusy(false);
    }
  }

  if (teams.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] p-3 text-[13px] text-[var(--color-text-muted)] shadow-[var(--shadow-card)]">
        Сначала создайте команды КТБ — этапы оцениваются по ним.
      </div>
    );
  }

  // Сумма по командам за все этапы — то же, что покажет табло после сохранения.
  const totals = new Map<number, number>(teams.map((t) => [t.id, 0]));
  for (const s of stages) {
    for (const t of teams) {
      totals.set(t.id, (totals.get(t.id) ?? 0) + (Number(s.scores[t.id]) || 0));
    }
  }

  return (
    <div className="flex flex-col gap-3 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Этапы</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={addStage}
            className="text-[13px] text-[var(--color-brand)]"
          >
            + Этап
          </button>
          <Button onClick={save} disabled={busy} className="px-3 py-1 text-xs">
            Сохранить этапы
          </Button>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Номер этапа — его место в списке; двигайте стрелками, номера
        пересчитаются сами. День — тот, в который этап прошёл: искры за него
        уйдут детям вместе с этим днём. Правки уходят в базу только по кнопке.
      </p>

      {stages.length === 0 && (
        <div className="text-[13px] text-[var(--color-text-muted)]">
          Этапов пока нет.
        </div>
      )}

      {stages.map((s, i) => {
        const win = winners(s.scores);
        return (
          <div
            key={s.key}
            className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[13px] font-semibold text-[var(--color-text-muted)]">
                №{i + 1}
              </span>
              <input
                value={s.title}
                onChange={(e) => patch(s.key, { title: e.target.value })}
                placeholder="Название этапа"
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px]"
              />
              <select
                value={s.day}
                onChange={(e) => patch(s.key, { day: Number(e.target.value) })}
                title="День смены, в который прошёл этап"
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-1 text-xs"
              >
                {board.days.map((d) => (
                  <option key={d.day_number} value={d.day_number}>
                    день {d.day_number}
                    {d.revealed ? " (отдан)" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                title="Выше"
                className="px-1 text-sm disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === stages.length - 1}
                title="Ниже"
                className="px-1 text-sm disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => setStages(stages.filter((x) => x.key !== s.key))}
                title="Удалить этап"
                className="text-xs text-[var(--color-danger)]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {teams.map((t) => (
                <label key={t.id} className="flex items-center gap-1 text-[13px]">
                  <span
                    className={
                      win.includes(t.id)
                        ? "text-[var(--color-brand)]"
                        : undefined
                    }
                  >
                    {t.name}
                  </span>
                  <input
                    type="number"
                    value={s.scores[t.id] ?? ""}
                    onChange={(e) =>
                      patch(s.key, {
                        scores: { ...s.scores, [t.id]: e.target.value },
                      })
                    }
                    className="w-16 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5"
                  />
                </label>
              ))}
            </div>

            <div className="text-xs text-[var(--color-text-muted)]">
              {win.length === 0
                ? "Этап не подведён — баллы не расставлены."
                : `Этап берёт: ${teams
                    .filter((t) => win.includes(t.id))
                    .map((t) => t.name)
                    .join(", ")}`}
            </div>
          </div>
        );
      })}

      {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}

      {stages.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-muted)]">
          <span>Сумма по этапам:</span>
          {teams.map((t) => (
            <span key={t.id}>
              {t.name}: <b className="text-[var(--color-text)]">{totals.get(t.id)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
