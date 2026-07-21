import { useMemo, useState } from "react";
import type { LiveMember } from "./live-types";

export function fio(m: LiveMember): string {
  return [m.l_name, m.f_name, m.m_name].filter(Boolean).join(" ");
}

// Список ростера с поиском: отмеченные — состав награды. `single` переключает
// на выбор одного (победитель, МВП, человек смены).
export function PeoplePicker({
  members,
  selected,
  onChange,
  single = false,
}: {
  members: LiveMember[];
  selected: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => fio(m).toLowerCase().includes(q) || String(m.number ?? "") === q,
    );
  }, [members, query]);

  function toggle(id: string): void {
    if (single) {
      onChange(selected[0] === id ? [] : [id]);
      return;
    }
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по ФИО или номеру"
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px]"
      />
      <div className="max-h-56 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
        {shown.map((m) => (
          <label
            key={m.user_id}
            className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[13px] hover:bg-[var(--color-bg)]"
          >
            <input
              type={single ? "radio" : "checkbox"}
              checked={selected.includes(m.user_id)}
              onChange={() => toggle(m.user_id)}
            />
            <span className="w-7 text-[var(--color-text-muted)]">
              {m.number ?? ""}
            </span>
            <span>{fio(m)}</span>
          </label>
        ))}
        {shown.length === 0 && (
          <div className="px-2 py-2 text-[13px] text-[var(--color-text-muted)]">
            Никого не найдено.
          </div>
        )}
      </div>
      <div className="text-xs text-[var(--color-text-muted)]">
        Выбрано: {selected.length}
      </div>
    </div>
  );
}
