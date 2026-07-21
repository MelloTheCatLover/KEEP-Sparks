import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import type { CupInput, LiveBoard } from "./live-types";

interface Draft {
  key: string;
  team_id: number;
  title: string;
}

function toDrafts(board: LiveBoard): Draft[] {
  return board.cups.map((c) => ({
    key: `c${c.id}`,
    team_id: c.team_id,
    title: c.title ?? "",
  }));
}

// Кубки КТП: кубок выдаётся команде, каждому её участнику пишется kgg_cup.
// Обладатель наибольшего числа кубков — победитель КТП.
export function CupsPanel({
  board,
  onSave,
}: {
  board: LiveBoard;
  onSave: (cups: CupInput[]) => Promise<void>;
}) {
  const [cups, setCups] = useState<Draft[]>(() => toDrafts(board));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);
  const teams = board.teams.ktp;

  useEffect(() => {
    setCups(toDrafts(board));
  }, [board]);

  async function save(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await onSave(
        cups.map((c) => ({ team_id: c.team_id, title: c.title.trim() || null })),
      );
    } catch {
      setErr("Не удалось сохранить кубки.");
    } finally {
      setBusy(false);
    }
  }

  if (teams.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] p-3 text-[13px] text-[var(--color-text-muted)] shadow-[var(--shadow-card)]">
        Сначала создайте команды КТП — кубки выдаются им.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Кубки</h3>
        <button
          onClick={() => {
            setCups([
              ...cups,
              { key: `new${nextKey}`, team_id: teams[0].id, title: "" },
            ]);
            setNextKey(nextKey + 1);
          }}
          className="text-[13px] text-[var(--color-brand)]"
        >
          + Кубок
        </button>
      </div>

      {cups.map((c) => (
        <div key={c.key} className="flex items-center gap-2">
          <input
            value={c.title}
            onChange={(e) =>
              setCups(
                cups.map((x) =>
                  x.key === c.key ? { ...x, title: e.target.value } : x,
                ),
              )
            }
            placeholder="Название кубка"
            className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px]"
          />
          <select
            value={c.team_id}
            onChange={(e) =>
              setCups(
                cups.map((x) =>
                  x.key === c.key
                    ? { ...x, team_id: Number(e.target.value) }
                    : x,
                ),
              )
            }
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-1 text-[13px]"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCups(cups.filter((x) => x.key !== c.key))}
            className="text-xs text-[var(--color-danger)]"
          >
            Удалить
          </button>
        </div>
      ))}

      {cups.length === 0 && (
        <div className="text-[13px] text-[var(--color-text-muted)]">
          Кубков пока нет.
        </div>
      )}

      {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}

      <div>
        <Button onClick={save} disabled={busy} className="px-3 py-1 text-xs">
          Сохранить кубки
        </Button>
      </div>
    </div>
  );
}
