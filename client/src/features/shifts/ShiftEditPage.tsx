import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { ACHIEVEMENT_COLUMNS as COLUMNS } from "../sparks/columns";
import { shiftsApi } from "./shifts-api";
import type {
  AddMembersResult,
  ShiftAchievementsGrid,
  ShiftDetail,
} from "./types";

// Programme tabs, in catalogue order — one sheet per group of achievements.
const GROUPS: string[] = COLUMNS.reduce<string[]>((acc, c) => {
  if (!acc.includes(c.group)) acc.push(c.group);
  return acc;
}, []);

// Full admin editor for one shift: meta (name/dates/person/in-rating) plus an
// editable grid of every member's achievement amounts. Sparks recompute on
// read, so a save is enough — no recalculation step. Works for any shift,
// including the pre-107 archive.
export function ShiftEditPage() {
  const { id } = useParams();
  const shiftId = Number(id);
  const validId = Number.isInteger(shiftId);

  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [grid, setGrid] = useState<ShiftAchievementsGrid | null>(null);
  const [error, setError] = useState(false);

  function load() {
    Promise.all([shiftsApi.detail(shiftId), shiftsApi.achievements(shiftId)])
      .then(([d, g]) => {
        setDetail(d);
        setGrid(g);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    if (!validId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId, validId]);

  if (error || !validId) {
    return <div className="text-[var(--color-danger)]">Смена не найдена.</div>;
  }
  if (!detail || !grid) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        to={`/admin/shifts/${shiftId}`}
        className="text-sm text-[var(--color-brand)]"
      >
        ← Смена {shiftId}
      </Link>

      <MetaForm detail={detail} members={grid.members} onSaved={setDetail} />
      <RosterPanel shiftId={shiftId} onRostered={setGrid} />
      <AchievementsGrid shiftId={shiftId} grid={grid} onSaved={setGrid} />
    </div>
  );
}

// Adds children to the shift roster from a pasted "Фамилия Имя [Отчество]" list
// (one per line) — mirrors how sparks are looked up elsewhere. Existing kids are
// matched and reused; missing ones are created and their fresh credentials shown
// once here. The refreshed grid flows back up so achievements can be entered.
function RosterPanel({
  shiftId,
  onRostered,
}: {
  shiftId: number;
  onRostered: (g: ShiftAchievementsGrid) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<AddMembersResult | null>(null);

  async function add() {
    const names = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await shiftsApi.addMembers(shiftId, names);
      onRostered(r.grid);
      setResult(r);
      setText("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <summary className="cursor-pointer text-sm font-semibold">
        Добавить участников
      </summary>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        По одному ФИО в строке: «Фамилия Имя Отчество». Уже существующие дети
        подхватываются по фамилии и имени, недостающие — создаются.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"Иванов Иван Иванович\nПетрова Мария Сергеевна"}
        className="mt-2 w-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-mono text-[13px] outline-none focus:border-[var(--color-brand)]"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          onClick={add}
          disabled={busy || text.trim() === ""}
          className="px-3 py-1.5 text-sm"
        >
          {busy ? "Добавляю…" : "Добавить в ростер"}
        </Button>
        {err && <span className="text-xs text-[var(--color-danger)]">{err}</span>}
      </div>
      {result && <RosterResult result={result} />}
    </details>
  );
}

function RosterResult({ result }: { result: AddMembersResult }) {
  return (
    <div className="mt-3 flex flex-col gap-2 text-[13px]">
      <p className="text-[var(--color-success)]">
        В ростер добавлено: {result.rostered} · создано новых: {result.created} ·
        найдено существующих: {result.reused}
      </p>
      {result.skipped.length > 0 && (
        <p className="text-[var(--color-danger)]">
          Не распознаны строки: {result.skipped.join("; ")}
        </p>
      )}
      {result.credentials.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-[var(--color-text-muted)]">
            Логины и пароли новых детей (показаны только сейчас):
          </p>
          <div className="overflow-x-auto">
            <table className="text-[13px] whitespace-nowrap">
              <tbody>
                {result.credentials.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className="py-1 pr-4">
                      {c.l_name} {c.f_name} {c.m_name ?? ""}
                    </td>
                    <td className="py-1 pr-4 font-mono">{c.login}</td>
                    <td className="py-1 font-mono">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaForm({
  detail,
  members,
  onSaved,
}: {
  detail: ShiftDetail;
  members: ShiftAchievementsGrid["members"];
  onSaved: (d: ShiftDetail) => void;
}) {
  const [name, setName] = useState(detail.name ?? "");
  const [start, setStart] = useState(detail.start_date);
  const [end, setEnd] = useState(detail.end_date);
  const [inRating, setInRating] = useState(detail.in_rating);
  const [person, setPerson] = useState(detail.person_user_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const summary = await shiftsApi.updateMeta(detail.shift_id, {
        name: name.trim() === "" ? null : name.trim(),
        start_date: start,
        end_date: end,
        in_rating: inRating,
        person_of_the_shift: person === "" ? null : person,
      });
      onSaved({ ...detail, ...summary });
      setOk(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const field = "border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] outline-none focus:border-[var(--color-brand)]";

  return (
    <div className="bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 text-sm font-semibold">Смена {detail.shift_id}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Название
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Человек смены
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className={field}
          >
            <option value="">— нет —</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.l_name} {m.f_name} {m.m_name ?? ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Начало
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Конец
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={field}
          />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={inRating}
          onChange={(e) => setInRating(e.target.checked)}
        />
        В глобальном рейтинге
      </label>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm">
          {busy ? "Сохраняю…" : "Сохранить мету"}
        </Button>
        {ok && <span className="text-xs text-[var(--color-success)]">Сохранено</span>}
        {err && <span className="text-xs text-[var(--color-danger)]">{err}</span>}
      </div>
    </div>
  );
}

function AchievementsGrid({
  shiftId,
  grid,
  onSaved,
}: {
  shiftId: number;
  grid: ShiftAchievementsGrid;
  onSaved: (g: ShiftAchievementsGrid) => void;
}) {
  // Working matrix: user_id -> setting name -> amount (as string for inputs).
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>(
    () => buildDraft(grid),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Active programme sheet; its columns are the only ones shown at a time.
  const [tab, setTab] = useState(GROUPS[0]);
  const cols = useMemo(() => COLUMNS.filter((c) => c.group === tab), [tab]);

  // Reset the draft whenever a fresh grid comes in (after a save/reload).
  useEffect(() => setDraft(buildDraft(grid)), [grid]);

  const settingId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of grid.settings) m[s.name] = s.id;
    return m;
  }, [grid.settings]);

  // Points per achievement, for the legend.
  const points = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of grid.settings) m[s.name] = s.value;
    return m;
  }, [grid.settings]);

  function set(userId: string, name: string, value: string) {
    setDraft((d) => ({ ...d, [userId]: { ...d[userId], [name]: value } }));
  }

  // Changed cells vs the loaded grid, as valid edits.
  const edits = useMemo(() => {
    const out: { user_id: string; setting_id: number; amount: number }[] = [];
    for (const m of grid.members) {
      for (const c of COLUMNS) {
        const raw = draft[m.user_id]?.[c.key] ?? "";
        const orig = m.counts[c.key] ?? 0;
        const n = raw === "" ? 0 : Number(raw);
        if (!Number.isInteger(n) || n < 0) continue;
        if (n !== orig) out.push({ user_id: m.user_id, setting_id: settingId[c.key], amount: n });
      }
    }
    return out;
  }, [draft, grid.members, settingId]);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      onSaved(await shiftsApi.saveAchievements(shiftId, edits));
      setOk(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">
          Достижения участников ({grid.members.length})
        </h3>
        <div className="flex items-center gap-3">
          {ok && <span className="text-xs text-[var(--color-success)]">Сохранено</span>}
          {err && <span className="text-xs text-[var(--color-danger)]">{err}</span>}
          <span className="text-xs text-[var(--color-text-muted)]">
            {edits.length} правок
          </span>
          <Button
            onClick={save}
            disabled={busy || edits.length === 0}
            className="px-3 py-1.5 text-sm"
          >
            {busy ? "Сохраняю…" : "Сохранить"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] px-3 py-2">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setTab(g)}
            className={
              "px-3 py-1 text-[13px] " +
              (g === tab
                ? "bg-[var(--color-brand)] text-white"
                : "bg-[var(--color-bg)] text-[var(--color-text-muted)]")
            }
          >
            {g}
          </button>
        ))}
      </div>
      <Legend cols={cols} points={points} />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)]">
              <th className="sticky left-0 bg-[var(--color-surface)] px-3 py-1.5 font-medium">
                Ребёнок
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  title={`${c.full} — ${c.hint} (${points[c.key] ?? 0} баллов)`}
                  className="px-2 py-1.5 text-center font-medium"
                >
                  {c.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.members.length === 0 && (
              <tr>
                <td
                  colSpan={cols.length + 1}
                  className="px-3 py-4 text-[var(--color-text-muted)]"
                >
                  В ростере пусто. Добавьте участников выше.
                </td>
              </tr>
            )}
            {grid.members.map((m) => (
              <tr key={m.user_id} className="border-t border-[var(--color-border)]">
                <td className="sticky left-0 bg-[var(--color-surface)] px-3 py-1">
                  {m.l_name} {m.f_name} {m.m_name ?? ""}
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    <input
                      type="number"
                      min={0}
                      value={draft[m.user_id]?.[c.key] ?? ""}
                      onChange={(e) => set(m.user_id, c.key, e.target.value)}
                      className="w-12 border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-right outline-none focus:border-[var(--color-brand)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Explains the codes of the active programme sheet, with the points each
// achievement is worth. Kept open so the codes in the grid are never a guess.
function Legend({
  cols,
  points,
}: {
  cols: typeof COLUMNS;
  points: Record<string, number>;
}) {
  return (
    <details open className="border-b border-[var(--color-border)] px-4 py-2.5">
      <summary className="cursor-pointer text-xs text-[var(--color-text-muted)]">
        Что означают столбцы
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {cols.map((c) => (
          <li key={c.key} className="flex items-baseline gap-2 text-[13px]">
            <span className="min-w-14 shrink-0 border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-center text-xs text-[var(--color-text-muted)]">
              {c.short}
            </span>
            <span>
              {c.hint}{" "}
              <span className="text-[var(--color-text-muted)]">
                · {points[c.key] ?? 0} баллов
              </span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function buildDraft(
  grid: ShiftAchievementsGrid,
): Record<string, Record<string, string>> {
  const d: Record<string, Record<string, string>> = {};
  for (const m of grid.members) {
    d[m.user_id] = {};
    for (const c of COLUMNS) {
      const v = m.counts[c.key] ?? 0;
      d[m.user_id][c.key] = v ? String(v) : "";
    }
  }
  return d;
}
