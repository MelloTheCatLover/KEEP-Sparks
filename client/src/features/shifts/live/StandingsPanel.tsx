import { useState } from "react";
import type { Contest, LiveBoard } from "./live-types";

// Итоговая таблица контеста: сумма баллов (КТБ) или число кубков (КТП) по
// командам. Победитель считается сам, когда лидер один; при равенстве его
// выбирает админ — до выбора победа никому не пишется.
export function StandingsPanel({
  board,
  contest,
  unit,
  onPick,
}: {
  board: LiveBoard;
  contest: Contest;
  unit: string;
  onPick: (teamId: number | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const st = board.standings[contest];
  const teams = board.teams[contest];
  const tie = st.leader_team_ids.length > 1;

  const sorted = [...teams].sort(
    (a, b) => (st.totals[b.id] ?? 0) - (st.totals[a.id] ?? 0),
  );

  async function pick(teamId: number | null): Promise<void> {
    setBusy(true);
    try {
      await onPick(teamId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold">Итог</h3>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="py-1 font-medium">Команда</th>
            <th className="py-1 font-medium">{unit}</th>
            <th className="py-1 font-medium">Победа</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="border-t border-[var(--color-border)]">
              <td className="py-1">{t.name}</td>
              <td className="py-1">{st.totals[t.id] ?? 0}</td>
              <td className="py-1">
                {st.winner_team_id === t.id ? (
                  <span className="text-[var(--color-brand)]">победитель</span>
                ) : st.leader_team_ids.includes(t.id) ? (
                  <span className="text-[var(--color-text-muted)]">лидер</span>
                ) : (
                  ""
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} className="py-2 text-[var(--color-text-muted)]">
                Команд пока нет.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {tie && st.manual_team_id === null && (
        <div className="text-xs text-[var(--color-danger)]">
          Равенство: победа не записана, выберите команду вручную.
        </div>
      )}

      {teams.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          Победитель вручную:
          <select
            value={st.manual_team_id ?? ""}
            disabled={busy}
            onChange={(e) =>
              pick(e.target.value === "" ? null : Number(e.target.value))
            }
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5"
          >
            <option value="">— автоматически</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
