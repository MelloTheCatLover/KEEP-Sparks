import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import type { LiveBoard, StageInput } from "./live-types";

interface Draft {
  key: string;
  number: number;
  title: string;
  scores: Record<number, string>; // строкой, чтобы поле можно было очистить
}

function toDrafts(board: LiveBoard): Draft[] {
  return board.stages.map((s) => ({
    key: `s${s.id}`,
    number: s.number,
    title: s.title ?? "",
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

  function addStage(): void {
    const number = Math.max(0, ...stages.map((s) => s.number)) + 1;
    setStages([
      ...stages,
      { key: `new${nextKey}`, number, title: "", scores: {} },
    ]);
    setNextKey(nextKey + 1);
  }

  function patch(key: string, fields: Partial<Draft>): void {
    setStages(stages.map((s) => (s.key === key ? { ...s, ...fields } : s)));
  }

  async function save(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await onSave(
        stages.map((s) => ({
          number: s.number,
          title: s.title.trim() || null,
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

  return (
    <div className="flex flex-col gap-3 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Этапы</h3>
        <button
          onClick={addStage}
          className="text-[13px] text-[var(--color-brand)]"
        >
          + Этап
        </button>
      </div>

      {stages.map((s) => {
        const win = winners(s.scores);
        return (
          <div
            key={s.key}
            className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2.5"
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={s.number}
                onChange={(e) =>
                  patch(s.key, { number: Number(e.target.value) })
                }
                className="w-16 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px]"
              />
              <input
                value={s.title}
                onChange={(e) => patch(s.key, { title: e.target.value })}
                placeholder="Название этапа"
                className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px]"
              />
              <button
                onClick={() =>
                  setStages(stages.filter((x) => x.key !== s.key))
                }
                className="text-xs text-[var(--color-danger)]"
              >
                Удалить
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

      <div>
        <Button onClick={save} disabled={busy} className="px-3 py-1 text-xs">
          Сохранить этапы
        </Button>
      </div>
    </div>
  );
}
