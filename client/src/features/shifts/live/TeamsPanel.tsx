import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { fio } from "./PeoplePicker";
import type { Contest, LiveBoard, TeamInput } from "./live-types";

interface Draft {
  key: string; // стабильный ключ строки, в т.ч. у ещё не сохранённой команды
  id?: number;
  name: string;
}

function toDrafts(board: LiveBoard, contest: Contest): Draft[] {
  return board.teams[contest].map((t) => ({
    key: `t${t.id}`,
    id: t.id,
    name: t.name,
  }));
}

function toAssign(board: LiveBoard, contest: Contest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of board.teams[contest]) {
    for (const uid of t.member_ids) out[uid] = `t${t.id}`;
  }
  return out;
}

// Команды контеста: список названий + распределение ростера по ним. Ребёнок
// состоит максимум в одной команде, поэтому распределение — выпадашка в строке
// ребёнка, а не отметки в каждой команде.
export function TeamsPanel({
  board,
  contest,
  onSave,
}: {
  board: LiveBoard;
  contest: Contest;
  onSave: (teams: TeamInput[]) => Promise<void>;
}) {
  const [teams, setTeams] = useState<Draft[]>(() => toDrafts(board, contest));
  const [assign, setAssign] = useState<Record<string, string>>(() =>
    toAssign(board, contest),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);

  // Правки в других блоках возвращают новую доску — синхронизируемся с ней.
  useEffect(() => {
    setTeams(toDrafts(board, contest));
    setAssign(toAssign(board, contest));
  }, [board, contest]);

  function addTeam(): void {
    setTeams([...teams, { key: `new${nextKey}`, name: "" }]);
    setNextKey(nextKey + 1);
  }

  function removeTeam(key: string): void {
    setTeams(teams.filter((t) => t.key !== key));
    setAssign(
      Object.fromEntries(
        Object.entries(assign).filter(([, v]) => v !== key),
      ),
    );
  }

  async function save(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const payload: TeamInput[] = teams.map((t) => ({
        id: t.id,
        name: t.name.trim(),
        member_ids: Object.entries(assign)
          .filter(([, key]) => key === t.key)
          .map(([uid]) => uid),
      }));
      if (payload.some((t) => !t.name)) {
        setErr("У каждой команды должно быть название.");
        return;
      }
      await onSave(payload);
    } catch {
      setErr("Не удалось сохранить команды.");
    } finally {
      setBusy(false);
    }
  }

  const unassigned = board.members.filter((m) => !assign[m.user_id]).length;

  return (
    <div className="flex flex-col gap-3 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Команды</h3>
        <button
          onClick={addTeam}
          className="text-[13px] text-[var(--color-brand)]"
        >
          + Команда
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {teams.map((t) => (
          <div key={t.key} className="flex items-center gap-2">
            <input
              value={t.name}
              onChange={(e) =>
                setTeams(
                  teams.map((x) =>
                    x.key === t.key ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              placeholder={contest === "ktb" ? "Номер или название" : "Название"}
              className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px]"
            />
            <span className="w-16 text-right text-xs text-[var(--color-text-muted)]">
              {Object.values(assign).filter((v) => v === t.key).length} чел.
            </span>
            <button
              onClick={() => removeTeam(t.key)}
              className="text-xs text-[var(--color-danger)]"
            >
              Удалить
            </button>
          </div>
        ))}
        {teams.length === 0 && (
          <div className="text-[13px] text-[var(--color-text-muted)]">
            Команд пока нет.
          </div>
        )}
      </div>

      {teams.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          {board.members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center gap-2 px-2 py-1 text-[13px]"
            >
              <span className="w-7 text-[var(--color-text-muted)]">
                {m.number ?? ""}
              </span>
              <span className="flex-1">{fio(m)}</span>
              <select
                value={assign[m.user_id] ?? ""}
                onChange={(e) =>
                  setAssign({ ...assign, [m.user_id]: e.target.value })
                }
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 text-xs"
              >
                <option value="">— без команды</option>
                {teams.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name || "без названия"}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy} className="px-3 py-1 text-xs">
          Сохранить команды
        </Button>
        <span className="text-xs text-[var(--color-text-muted)]">
          Без команды: {unassigned}
        </span>
      </div>
    </div>
  );
}
