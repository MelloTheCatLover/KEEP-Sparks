import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { PeoplePicker, fio } from "./PeoplePicker";
import type { AwardKind, LiveBoard, LiveMember } from "./live-types";

export function awardPeople(
  board: LiveBoard,
  kind: AwardKind,
  day = 0,
): string[] {
  return (
    board.awards.find((a) => a.kind === kind && a.day_number === day)
      ?.user_ids ?? []
  );
}

// Одна награда: раскрывающийся список ростера, сохранение заменяет её состав
// целиком и возвращает пересчитанную доску.
export function AwardBlock({
  board,
  kind,
  day = 0,
  title,
  hint,
  single = false,
  onSaved,
}: {
  board: LiveBoard;
  kind: AwardKind;
  day?: number;
  title: string;
  hint?: string;
  single?: boolean;
  onSaved: (kind: AwardKind, day: number, ids: string[]) => Promise<void>;
}) {
  const saved = awardPeople(board, kind, day);
  const [selected, setSelected] = useState<string[]>(saved);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Доска могла обновиться из-за правки в соседнем блоке — подтягиваем состав,
  // пока список свёрнут (в раскрытом это затёрло бы несохранённый выбор).
  useEffect(() => {
    if (!open) setSelected(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const dirty =
    selected.length !== saved.length ||
    selected.some((id) => !saved.includes(id));

  const byId = new Map(board.members.map((m) => [m.user_id, m]));
  const names = saved
    .map((id) => byId.get(id))
    .filter((m): m is LiveMember => m !== undefined)
    .map(fio);

  async function save(): Promise<void> {
    setBusy(true);
    try {
      await onSaved(kind, day, selected);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium">{title}</div>
          <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {names.length ? names.join(", ") : "—"}
          </div>
          {hint && (
            <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {hint}
            </div>
          )}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="shrink-0 text-[13px] text-[var(--color-brand)]"
        >
          {open ? "Свернуть" : "Изменить"}
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <PeoplePicker
            members={board.members}
            selected={selected}
            onChange={setSelected}
            single={single}
          />
          <div className="flex gap-2">
            <Button
              onClick={save}
              disabled={busy || !dirty}
              className="px-3 py-1 text-xs"
            >
              Сохранить
            </Button>
            <button
              onClick={() => setSelected(saved)}
              disabled={!dirty}
              className="text-xs text-[var(--color-text-muted)] disabled:opacity-50"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
