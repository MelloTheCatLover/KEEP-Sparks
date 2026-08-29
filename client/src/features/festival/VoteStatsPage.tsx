import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { festivalApi, getJudgeToken } from "./festival-api";
import { numberColor } from "./format";
import type { FestivalVoteTally } from "./types";

// Статистика финального голосования — для судейского стола. Голоса анонимные,
// поэтому «кто за кого» здесь означает счёт по финалистам: сколько голосов у
// каждого номера, сколько всего и когда пришёл последний.
//
// Экран открывается ссылкой с судейского и живёт под тем же кодом судьи.

const POLL_MS = 4000;

export function VoteStatsPage() {
  const [tally, setTally] = useState<FestivalVoteTally | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Без кода судьи запрашивать нечего: страницу открыли не с судейского экрана.
  const authorized = getJudgeToken() !== null;

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    async function tick(): Promise<void> {
      try {
        const next = await festivalApi.judge.votes();
        if (active) setTally(next);
      } catch (err) {
        if (active && err instanceof ApiError && err.status === 401) {
          setError("Код судьи просрочен — войдите заново");
        }
      }
    }
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [authorized]);

  if (!authorized) {
    return (
      <div className="p-6 text-[var(--color-text-muted)]">
        Нужен код судьи — откройте эту страницу со своего экрана.
      </div>
    );
  }
  if (error) return <div className="p-6 text-[var(--color-danger)]">{error}</div>;
  if (!tally) {
    return <div className="p-6 text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const leader = tally.rows[0]?.votes ?? 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 p-3">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Голосование</h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {tally.total} {tally.voting_open ? "· идёт" : "· закрыто"}
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {tally.rows.map((row) => {
          const color = numberColor(row.color, row.team);
          // Доля от лидера, а не от общего: при 3 кандидатах так виден отрыв.
          const width = leader > 0 ? Math.round((row.votes / leader) * 100) : 0;
          return (
            <div
              key={row.participant_id}
              className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-black"
                  style={{ background: color }}
                >
                  {row.number}
                </span>
                <span className="min-w-0 flex-1 text-base">{row.name}</span>
                <span className="text-2xl font-semibold tabular-nums">
                  {row.votes}
                </span>
              </div>
              <div className="mt-2 h-2 w-full bg-[var(--color-elevated)]">
                <div
                  className="h-2 transition-[width] duration-500"
                  style={{ width: `${width}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
        {tally.rows.length === 0 && (
          <div className="text-sm text-[var(--color-text-muted)]">
            Финалисты не отмечены.
          </div>
        )}
      </div>

      <a href="/festival/judge" className="text-sm text-[var(--color-text-muted)] underline">
        назад к отметкам
      </a>
    </div>
  );
}
