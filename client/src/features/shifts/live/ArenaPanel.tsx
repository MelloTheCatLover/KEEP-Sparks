import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import type { ArenaRoundInput, LiveBoard } from "./live-types";

interface Draft {
  key: string;
  title: string;
  day: number;
  winner: number | null; // id комнаты
}

function toDrafts(board: LiveBoard): Draft[] {
  return board.arena.map((r) => ({
    key: `a${r.id}`,
    title: r.title ?? "",
    day: r.day_number,
    winner: r.winner_team_id,
  }));
}

// Wake Up Арена: раунды играют комнаты, победившая приносит искры каждому
// своему жителю. Раундов за смену 4, на пятидневках 2 — панель об этом
// напоминает, но не запрещает: смена может пойти не по плану.
//
// Номер раунда — его место в списке (как у этапов КТБ), день — тот, в который
// арена прошла: искры уйдут ребёнку вместе с этим днём. Пока победитель не
// выбран, раунд никого не награждает.
export function ArenaPanel({
  board,
  onSave,
}: {
  board: LiveBoard;
  onSave: (rounds: ArenaRoundInput[]) => Promise<void>;
}) {
  const [rounds, setRounds] = useState<Draft[]>(() => toDrafts(board));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);
  const rooms = board.teams.room;

  useEffect(() => {
    setRounds(toDrafts(board));
  }, [board]);

  const currentDay =
    board.days.find((d) => !d.revealed)?.day_number ?? board.day_count;

  function addRound(): void {
    setRounds([
      ...rounds,
      { key: `new${nextKey}`, title: "", day: currentDay, winner: null },
    ]);
    setNextKey(nextKey + 1);
  }

  function patch(key: string, fields: Partial<Draft>): void {
    setRounds(rounds.map((r) => (r.key === key ? { ...r, ...fields } : r)));
  }

  function move(index: number, delta: number): void {
    const to = index + delta;
    if (to < 0 || to >= rounds.length) return;
    const next = [...rounds];
    [next[index], next[to]] = [next[to], next[index]];
    setRounds(next);
  }

  async function save(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await onSave(
        rounds.map((r) => ({
          title: r.title.trim() || null,
          day_number: r.day,
          winner_team_id: r.winner,
        })),
      );
    } catch {
      setErr("Не удалось сохранить раунды.");
    } finally {
      setBusy(false);
    }
  }

  if (rooms.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] p-3 text-[13px] text-[var(--color-text-muted)] shadow-[var(--shadow-card)]">
        Сначала заведите комнаты — арену играют ими.
      </div>
    );
  }

  // Сколько раундов взяла каждая комната: по этому счёту видно, не собрала ли
  // одна комната всю арену.
  const wins = new Map<number, number>(rooms.map((r) => [r.id, 0]));
  for (const r of rounds) {
    if (r.winner !== null) wins.set(r.winner, (wins.get(r.winner) ?? 0) + 1);
  }
  const scored = rounds.filter((r) => r.winner !== null).length;

  return (
    <div className="flex flex-col gap-3 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Раунды Wake Up Арены</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={addRound}
            className="text-[13px] text-[var(--color-brand)]"
          >
            + Раунд
          </button>
          <Button onClick={save} disabled={busy} className="px-3 py-1 text-xs">
            Сохранить раунды
          </Button>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        По плану раундов на эту смену: {board.arena_rounds_planned} (сейчас
        заведено {rounds.length}, подведено {scored}). Победившая комната
        приносит искры каждому своему жителю — за день, в который прошёл раунд.
      </p>

      {rounds.length === 0 && (
        <div className="text-[13px] text-[var(--color-text-muted)]">
          Раундов пока нет.
        </div>
      )}

      {rounds.map((r, i) => (
        <div
          key={r.key}
          className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2.5"
        >
          <span className="w-8 shrink-0 text-[13px] font-semibold text-[var(--color-text-muted)]">
            №{i + 1}
          </span>
          <input
            value={r.title}
            onChange={(e) => patch(r.key, { title: e.target.value })}
            placeholder="Название раунда"
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px]"
          />
          <select
            value={r.winner ?? ""}
            onChange={(e) =>
              patch(r.key, {
                winner: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            title="Комната-победитель"
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-1 text-xs"
          >
            <option value="">не подведён</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.member_ids.length})
              </option>
            ))}
          </select>
          <select
            value={r.day}
            onChange={(e) => patch(r.key, { day: Number(e.target.value) })}
            title="День смены, в который прошёл раунд"
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
            disabled={i === rounds.length - 1}
            title="Ниже"
            className="px-1 text-sm disabled:opacity-30"
          >
            ↓
          </button>
          <button
            onClick={() => setRounds(rounds.filter((x) => x.key !== r.key))}
            title="Удалить раунд"
            className="text-xs text-[var(--color-danger)]"
          >
            ✕
          </button>
        </div>
      ))}

      {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}

      {rounds.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-muted)]">
          <span>Взято раундов:</span>
          {rooms.map((room) => (
            <span key={room.id}>
              {room.name}:{" "}
              <b className="text-[var(--color-text)]">{wins.get(room.id) ?? 0}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
