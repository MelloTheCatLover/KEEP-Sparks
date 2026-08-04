import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "../../shared/ui/Button";
import { sparksApi } from "../sparks/sparks-api";
import type { KtbTeammate, MyKtbTeam } from "../sparks/types";
import { formatLeft, useCountdown } from "./countdown";
import "./ktb-reveal.css";

const BURST_MS = 950; // столько летит фейерверк, прежде чем показать команду
const SPARK_COLORS = [
  "var(--color-brand)",
  "var(--color-warning)",
  "var(--color-success)",
  "var(--color-info)",
];

function fio(m: KtbTeammate): string {
  return [m.l_name, m.f_name].filter(Boolean).join(" ");
}

// Частицы фейерверка: угол разлёта раскидан по кругу, дальность и задержка —
// вразнобой, иначе взрыв выглядит как ровная снежинка.
function Fireworks() {
  const sparks = Array.from({ length: 24 }, (_, i) => ({
    a: `${(360 / 24) * i + (i % 3) * 5}deg`,
    d: `${52 + ((i * 37) % 46)}px`,
    t: `${(i % 6) * 45}ms`,
    c: SPARK_COLORS[i % SPARK_COLORS.length],
  }));

  return (
    <div className="ktb-sparks" aria-hidden>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="ktb-spark"
          style={
            {
              "--a": s.a,
              "--d": s.d,
              "--t": s.t,
              background: s.c,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function TeamRoster({ members, animate }: { members: KtbTeammate[]; animate: boolean }) {
  return (
    <ul className="mt-3 flex flex-col gap-1">
      {members.map((m, i) => (
        <li
          key={m.user_id}
          className={
            "flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-1 py-1 text-[13px] last:border-b-0 " +
            (m.is_me ? "font-semibold text-[var(--color-brand)] " : "") +
            (animate ? "ktb-member" : "")
          }
          style={
            animate
              ? ({ animationDelay: `${i * 60}ms` } as CSSProperties)
              : undefined
          }
        >
          <span>{fio(m)}</span>
          {m.is_me && (
            <span className="text-xs text-[var(--color-text-muted)]">это ты</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// Составы КТБ в кабинете ребёнка. Три состояния: замок с отсчётом до
// назначенного часа, закрытый сундук после него и уже открытая команда.
//
// Состав до раскрытия не приходит вовсе — сервер отдаёт только час. Поэтому
// подсмотреть команду через инструменты разработчика нельзя, и всё, что делает
// эта карточка, — показывает то, что уже пришло.
export function KtbTeamCard({
  ktb,
  onReveal,
  onOpened,
}: {
  ktb: MyKtbTeam;
  onReveal: () => void;
  onOpened: (next: MyKtbTeam | null) => void;
}) {
  const left = useCountdown(ktb.revealed ? null : ktb.reveal_at, onReveal);
  const [phase, setPhase] = useState<"closed" | "burst" | "done">("closed");
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  // Ждать ответа сервера, чтобы запустить анимацию, незачем: состав уже на
  // руках, а отметка «открыл» нужна лишь для следующего захода.
  function open(): void {
    setPhase("burst");
    setBusy(true);
    timer.current = window.setTimeout(() => setPhase("done"), BURST_MS);
    sparksApi
      .openKtbTeam()
      .then(onOpened)
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }

  if (!ktb.revealed) {
    return (
      <div className="border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center shadow-[var(--shadow-card)]">
        <div className="text-base font-semibold">🔒 Составы КТБ готовы</div>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          {left !== null && left > 0
            ? `узнаешь свою команду через ${formatLeft(left)}`
            : "открываем…"}
        </p>
      </div>
    );
  }

  const team = ktb.team;
  if (!team) return null;

  // Сундук: показывается, пока ребёнок не открыл его — ни сейчас, ни раньше.
  if (!ktb.opened && phase !== "done") {
    return (
      <div className="border-2 border-[var(--color-brand)] bg-[var(--color-surface)] p-4 text-center shadow-[var(--shadow-card)]">
        <div className="text-base font-semibold">Составы КТБ</div>
        <div className="ktb-stage mt-2">
          {phase === "burst" && <Fireworks />}
          <span
            className={"ktb-chest" + (phase === "burst" ? " ktb-chest--burst" : "")}
            aria-hidden
          >
            🧰
          </span>
        </div>
        {phase === "closed" ? (
          <Button onClick={open} disabled={busy} className="mt-1 px-5 py-2">
            Открыть сундук
          </Button>
        ) : (
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            открываем…
          </p>
        )}
      </div>
    );
  }

  const animate = phase === "done";

  return <OpenedTeam team={team} animate={animate} />;
}

// Раскрытая команда. Список сворачивается: на смене к нему возвращаются ради
// названия, а полный состав занимает пол-экрана телефона. Свёрнутое состояние
// не запоминается — сразу после сундука состав должен быть виден целиком.
function OpenedTeam({
  team,
  animate,
}: {
  team: { name: string; members: KtbTeammate[] };
  animate: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-2 border-[var(--color-brand)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="text-center">
        <div className="text-[13px] text-[var(--color-text-muted)]">
          Твоя команда КТБ
        </div>
        <div
          className={
            "mt-1 text-2xl font-bold text-[var(--color-brand)] " +
            (animate ? "ktb-name" : "")
          }
        >
          {team.name}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)]"
      >
        <span>{team.members.length} человек</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        <span className="sr-only">
          {open ? "свернуть состав" : "показать состав"}
        </span>
      </button>

      {open && <TeamRoster members={team.members} animate={animate} />}
    </div>
  );
}
