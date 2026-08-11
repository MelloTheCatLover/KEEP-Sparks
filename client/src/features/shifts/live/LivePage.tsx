import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../../shared/ui/Button";
import { AwardBlock } from "./AwardBlock";
import { CupsPanel } from "./CupsPanel";
import { DaysPanel } from "./DaysPanel";
import { KtbDraftPanel } from "./KtbDraftPanel";
import { ArenaPanel } from "./ArenaPanel";
import { StagesPanel } from "./StagesPanel";
import { StandingsPanel } from "./StandingsPanel";
import { TeamsPanel } from "./TeamsPanel";
import { liveApi } from "./live-api";
import type { AwardKind, LiveBoard } from "./live-types";

type Tab =
  | "reality"
  | "ktb"
  | "ktp"
  | "arena"
  | "days"
  | "schedule"
  | "final";

const TABS: { id: Tab; label: string }[] = [
  { id: "reality", label: "Реалити-шоу" },
  { id: "ktb", label: "КТБ" },
  { id: "ktp", label: "КТП / КГГ" },
  { id: "arena", label: "Wake Up Арена" },
  { id: "days", label: "Человек дня" },
  { id: "schedule", label: "Дни смены" },
  { id: "final", label: "Итоги смены" },
];

// Ведение смены по традициям: награды отмечаются по ходу смены, достижения и
// искры пересчитываются из них после каждой правки. Ручная сетка достижений
// (редактор смены) остаётся для всего, что сюда не попадает — звёзд и дней
// присутствия.
export function LivePage() {
  const { id } = useParams();
  const shiftId = Number(id);
  const validId = Number.isInteger(shiftId);

  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("reality");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!validId) return;
    let active = true;
    liveApi
      .board(shiftId)
      .then((b) => active && setBoard(b))
      .catch(() => active && setError("Смена не найдена."));
    return () => {
      active = false;
    };
  }, [shiftId, validId]);

  if (error || !validId) {
    return (
      <div className="text-[var(--color-danger)]">
        {error ?? "Смена не найдена."}
      </div>
    );
  }
  if (!board) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const saveAward = async (
    kind: AwardKind,
    day: number,
    ids: string[],
  ): Promise<void> => {
    setBoard(await liveApi.saveAward(shiftId, kind, day, ids));
  };

  async function toggleMode(): Promise<void> {
    const b = board!;
    if (!b.live_mode && b.has_legacy_achievements) {
      const ok = confirm(
        "У смены уже есть достижения по традициям, загруженные не через ведение.\n" +
          "Включение режима перезапишет их тем, что отмечено здесь (сейчас — пусто).\n" +
          "Продолжить?",
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      setBoard(await liveApi.setMode(shiftId, !b.live_mode));
    } catch {
      setError("Не удалось переключить режим ведения.");
    } finally {
      setBusy(false);
    }
  }

  const days = Array.from({ length: board.day_count }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-3">
      <Link
        to={`/admin/shifts/${shiftId}`}
        className="text-sm text-[var(--color-brand)]"
      >
        ← Смена {shiftId}
      </Link>

      <div className="flex items-start justify-between gap-3 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
        <div>
          <h2 className="text-base font-semibold">Ведение смены {shiftId}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {board.start_date} – {board.end_date} · дней: {board.day_count} ·
            детей: {board.members.length}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {board.live_mode
              ? "Режим включён: достижения традиций пересчитываются из отмеченного здесь."
              : "Режим выключен — правки недоступны."}
          </p>
        </div>
        <Button onClick={toggleMode} disabled={busy} className="px-3 py-1 text-xs">
          {board.live_mode ? "Выключить ведение" : "Включить ведение"}
        </Button>
      </div>

      {!board.live_mode && board.has_legacy_achievements && (
        <div className="border border-[var(--color-danger)] p-2.5 text-xs text-[var(--color-danger)]">
          У смены есть достижения традиций, загруженные из таблицы. Включение
          ведения перезапишет их.
        </div>
      )}

      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "rounded-[var(--radius-sm)] px-3 py-1 text-[13px] " +
              (tab === t.id
                ? "bg-[var(--color-brand)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)]")
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      <fieldset
        disabled={!board.live_mode}
        className="flex flex-col gap-3 border-0 p-0 disabled:opacity-60"
      >
        {tab === "reality" && (
          <>
            <div className="flex flex-col gap-2 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
              <h3 className="text-sm font-semibold">Лучший в реалити по дням</h3>
              {days.map((d) => (
                <AwardBlock
                  key={d}
                  board={board}
                  kind="reality_leader"
                  day={d}
                  title={`День ${d}`}
                  onSaved={saveAward}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
              <h3 className="text-sm font-semibold">Итоги реалити</h3>
              <AwardBlock
                board={board}
                kind="reality_winner"
                title="Победитель"
                hint="Победителю автоматически засчитываются суперфинал и финал."
                single
                onSaved={saveAward}
              />
              <AwardBlock
                board={board}
                kind="reality_super_finalist"
                title="Суперфиналисты"
                hint="Суперфиналистам автоматически засчитывается финал."
                onSaved={saveAward}
              />
              <AwardBlock
                board={board}
                kind="reality_finalist"
                title="Финалисты"
                onSaved={saveAward}
              />
              <AwardBlock
                board={board}
                kind="reality_plot"
                title="Двигатель сюжета"
                onSaved={saveAward}
              />
            </div>
          </>
        )}

        {tab === "ktb" && (
          <>
            <KtbDraftPanel
              board={board}
              onPlan={(names) => liveApi.ktbPlan(shiftId, names)}
              onSave={async (teams) =>
                setBoard(await liveApi.saveTeams(shiftId, "ktb", teams))
              }
              onSetReveal={async (at) =>
                setBoard(await liveApi.setKtbReveal(shiftId, at))
              }
            />
            <TeamsPanel
              board={board}
              contest="ktb"
              onSave={async (teams) =>
                setBoard(await liveApi.saveTeams(shiftId, "ktb", teams))
              }
            />
            <StagesPanel
              board={board}
              onSave={async (stages) =>
                setBoard(await liveApi.saveStages(shiftId, stages))
              }
            />
            <StandingsPanel
              board={board}
              contest="ktb"
              unit="Баллы"
              onPick={async (teamId) =>
                setBoard(await liveApi.setWinner(shiftId, "ktb", teamId))
              }
            />
            <div className="bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
              <h3 className="mb-2 text-sm font-semibold">Лучшие в команде</h3>
              <AwardBlock
                board={board}
                kind="ktb_team_best"
                title="Лучший в команде"
                hint="Список — по одному (или нескольким) от каждой команды."
                onSaved={saveAward}
              />
            </div>
          </>
        )}

        {tab === "ktp" && (
          <>
            <TeamsPanel
              board={board}
              contest="ktp"
              onSave={async (teams) =>
                setBoard(await liveApi.saveTeams(shiftId, "ktp", teams))
              }
            />
            <CupsPanel
              board={board}
              onSave={async (cups) =>
                setBoard(await liveApi.saveCups(shiftId, cups))
              }
            />
            <StandingsPanel
              board={board}
              contest="ktp"
              unit="Кубки"
              onPick={async (teamId) =>
                setBoard(await liveApi.setWinner(shiftId, "ktp", teamId))
              }
            />
            <div className="bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
              <h3 className="mb-2 text-sm font-semibold">Лучший из лучших</h3>
              <AwardBlock
                board={board}
                kind="kgg_mvp"
                title="МВП"
                single
                onSaved={saveAward}
              />
            </div>
          </>
        )}

        {tab === "arena" && (
          <>
            <TeamsPanel
              board={board}
              contest="room"
              title="Комнаты"
              unit="комнат"
              addLabel="+ Комната"
              onSave={async (teams) =>
                setBoard(await liveApi.saveTeams(shiftId, "room", teams))
              }
            />
            <ArenaPanel
              board={board}
              onSave={async (rounds) =>
                setBoard(await liveApi.saveArena(shiftId, rounds))
              }
            />
          </>
        )}

        {tab === "days" && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-semibold">Человек дня</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              В один день можно отметить нескольких.
            </p>
            {days.map((d) => (
              <AwardBlock
                key={d}
                board={board}
                kind="person_of_day"
                day={d}
                title={`День ${d}`}
                onSaved={saveAward}
              />
            ))}
          </div>
        )}

        {tab === "schedule" && (
          <DaysPanel
            board={board}
            shiftId={shiftId}
            onToggle={async (day, ready) =>
              setBoard(await liveApi.setDayReady(shiftId, day, ready))
            }
            loadAwards={liveApi.dayAwards}
          />
        )}

        {tab === "final" && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-semibold">Итоги смены</h3>
            <AwardBlock
              board={board}
              kind="person_of_shift"
              title="Человек смены"
              single
              onSaved={saveAward}
            />
            <AwardBlock
              board={board}
              kind="recognition"
              title="Признание руководителя"
              onSaved={saveAward}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              Звёзды на летних сменах не проводятся — если понадобятся, они
              вводятся в ручной сетке достижений в редакторе смены.
            </p>
          </div>
        )}
      </fieldset>
    </div>
  );
}
