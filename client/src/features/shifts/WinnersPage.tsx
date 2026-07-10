import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { shiftsApi } from "./shifts-api";
import type { ShiftWinners, WinnerPerson } from "./types";

// Reality-show winners board: one block per shift with the winner highlighted
// and the finalists listed — the same layout as the "Победители и финалисты"
// sheet, but read live from the achievements in the system.
export function WinnersPage() {
  const [board, setBoard] = useState<ShiftWinners[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    shiftsApi
      .winners()
      .then((b) => active && setBoard(b))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить победителей.
      </div>
    );
  }
  if (!board) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">
          Победители и финалисты реалити-шоу ({board.length} смен)
        </h2>
      </div>
      {board.map((s) => (
        <ShiftBlock key={s.shift_id} data={s} />
      ))}
    </div>
  );
}

function ShiftBlock({ data }: { data: ShiftWinners }) {
  const winnerId = data.winner?.user_id;
  return (
    <div className="bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="mb-2 flex items-baseline justify-between">
        <Link
          to={`/admin/shifts/${data.shift_id}`}
          className="text-sm font-semibold text-[var(--color-brand)]"
        >
          Смена {data.shift_id}
        </Link>
        <span className="text-xs text-[var(--color-text-muted)]">
          финалистов: {data.finalists.length}
        </span>
      </div>

      <p className="mb-2 text-[13px]">
        <span className="text-[var(--color-text-muted)]">Победитель:</span>{" "}
        {data.winner ? (
          <span className="font-semibold">🏆 {fullName(data.winner)}</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">не отмечен</span>
        )}
      </p>

      <p className="mb-1 text-xs text-[var(--color-text-muted)]">Финалисты:</p>
      {data.finalists.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">—</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {data.finalists.map((p) => (
            <li
              key={p.user_id}
              className={
                "border px-2 py-0.5 text-[13px] " +
                (p.user_id === winnerId
                  ? "border-[var(--color-brand)] font-semibold"
                  : "border-[var(--color-border)]")
              }
            >
              {fullName(p)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fullName(p: WinnerPerson): string {
  return [p.l_name, p.f_name, p.m_name].filter(Boolean).join(" ");
}
