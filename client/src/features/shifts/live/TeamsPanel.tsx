import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { fio } from "./PeoplePicker";
import type { LiveBoard, LiveMember, TeamInput, TeamKind } from "./live-types";

interface Draft {
  key: string; // стабильный ключ строки, в т.ч. у ещё не сохранённой команды
  id?: number;
  name: string;
}

const NONE = ""; // ключ «без команды»

function toDrafts(board: LiveBoard, contest: TeamKind): Draft[] {
  return board.teams[contest].map((t) => ({
    key: `t${t.id}`,
    id: t.id,
    name: t.name,
  }));
}

function toAssign(board: LiveBoard, contest: TeamKind): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of board.teams[contest]) {
    for (const uid of t.member_ids) out[uid] = `t${t.id}`;
  }
  return out;
}

// Внутри команды — по номеру ребёнка, а не по алфавиту: номер и есть то, чем
// админ оперирует вслух («37-й в какой команде?»). Безномерные — в конец.
function byNumber(a: LiveMember, b: LiveMember): number {
  return (a.number ?? 1e9) - (b.number ?? 1e9) || fio(a).localeCompare(fio(b));
}

// Команды контеста — карточками, а не общим списком ростера: состав смотрят
// командой целиком («кто у Ромы?»), и алфавитный список на 40 человек с
// выпадашкой в каждой строке для этого не годится.
//
// Ребёнок состоит максимум в одной команде, поэтому перевод — выпадашка в его
// строке: выбрал другую команду, ребёнок уехал туда. Ничего не сохраняется, пока
// не нажата кнопка, — можно перетасовать всех и посмотреть, что вышло.
export function TeamsPanel({
  board,
  contest,
  onSave,
  // Комнаты — тот же состав, но называются иначе: панель переиспользуется, а
  // подписи задаются снаружи.
  title = "Команды",
  unit = "команд",
  addLabel = "+ Команда",
}: {
  board: LiveBoard;
  contest: TeamKind;
  onSave: (teams: TeamInput[]) => Promise<void>;
  title?: string;
  unit?: string;
  addLabel?: string;
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

  // Удалённая команда не уносит детей с собой — они возвращаются в «Без
  // команды», откуда их видно и можно раздать заново.
  function removeTeam(key: string): void {
    setTeams(teams.filter((t) => t.key !== key));
    setAssign(
      Object.fromEntries(
        Object.entries(assign).map(([uid, k]) => [uid, k === key ? NONE : k]),
      ),
    );
  }

  function move(userId: string, key: string): void {
    setAssign({ ...assign, [userId]: key });
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

  const members = (key: string): LiveMember[] =>
    board.members
      .filter((m) => (assign[m.user_id] ?? NONE) === key)
      .sort(byNumber);

  const unassigned = members(NONE);

  // Строка ребёнка: номер, ФИО и перевод в другую команду.
  const row = (m: LiveMember, key: string) => (
    <li
      key={m.user_id}
      className="flex items-center gap-2 border-t border-[var(--color-border)] px-2 py-1 text-[13px] first:border-t-0"
    >
      <span className="w-6 shrink-0 text-xs text-[var(--color-text-muted)]">
        {m.number ?? ""}
      </span>
      <span className="flex-1 truncate">{fio(m)}</span>
      <select
        value={key}
        onChange={(e) => move(m.user_id, e.target.value)}
        title="Перевести в другую команду"
        className="max-w-28 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1 py-0.5 text-xs"
      >
        <option value={NONE}>— без команды</option>
        {teams.map((t) => (
          <option key={t.key} value={t.key}>
            {t.name || "без названия"}
          </option>
        ))}
      </select>
    </li>
  );

  return (
    <div className="flex flex-col gap-3 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {teams.length} {unit} · без места: {unassigned.length}
          </span>
          <button
            onClick={addTeam}
            className="text-[13px] text-[var(--color-brand)]"
          >
            {addLabel}
          </button>
          <Button onClick={save} disabled={busy} className="px-3 py-1 text-xs">
            Сохранить
          </Button>
        </div>
      </div>

      {err && <div className="text-xs text-[var(--color-danger)]">{err}</div>}

      {teams.length === 0 && unassigned.length === 0 && (
        <div className="text-[13px] text-[var(--color-text-muted)]">
          Команд пока нет.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <div
            key={t.key}
            className="flex flex-col rounded-[var(--radius-sm)] border border-[var(--color-border)]"
          >
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-1.5">
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
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px] font-medium"
              />
              <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                {members(t.key).length} чел.
              </span>
              <button
                onClick={() => removeTeam(t.key)}
                title="Удалить команду"
                className="shrink-0 text-xs text-[var(--color-danger)]"
              >
                ✕
              </button>
            </div>
            <ul className="flex flex-col">
              {members(t.key).map((m) => row(m, t.key))}
              {members(t.key).length === 0 && (
                <li className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
                  Пусто — переведите сюда кого-нибудь из другой команды.
                </li>
              )}
            </ul>
          </div>
        ))}

        {unassigned.length > 0 && (
          <div className="flex flex-col rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)]">
            <div className="border-b border-[var(--color-border)] p-1.5 text-[13px] font-medium">
              Без команды
              <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                {unassigned.length} чел.
              </span>
            </div>
            <ul className="flex flex-col">
              {unassigned.map((m) => row(m, NONE))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
