import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { downloadCsv } from "../../shared/lib/csv";
import { shiftsApi } from "../shifts/shifts-api";
import type { ShiftSummary } from "../shifts/types";
import { childrenApi } from "./children-api";
import type { ChildAccount } from "./types";

const inputCls =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px] outline-none focus:border-[var(--color-brand)]";

export function ChildrenPage() {
  const [items, setItems] = useState<ChildAccount[] | null>(null);
  const [shifts, setShifts] = useState<ShiftSummary[]>([]);
  const [filter, setFilter] = useState<number | "all">("all");
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([childrenApi.list(), shiftsApi.list()])
      .then(([c, s]) => {
        if (!active) return;
        setItems(c);
        setShifts(s);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  function sortByName(list: ChildAccount[]): ChildAccount[] {
    return [...list].sort(
      (a, b) =>
        a.l_name.localeCompare(b.l_name) || a.f_name.localeCompare(b.f_name),
    );
  }

  async function generate() {
    const target = filter === "all" ? undefined : filter;
    const label = filter === "all" ? "всем детям" : `детям смены ${filter}`;
    if (
      !window.confirm(
        `Сгенерировать новые пароли ${label}? Старые пароли перестанут работать. ` +
          `Файл с логинами и паролями скачается сразу.`,
      )
    )
      return;

    setGenBusy(true);
    setGenNote(null);
    try {
      const creds = await childrenApi.generatePasswords(target);
      if (creds.length === 0) {
        setGenNote("Нет детей по выбранному фильтру.");
        return;
      }
      downloadCsv(
        `passwords-${filter === "all" ? "all" : "shift" + filter}.csv`,
        ["Фамилия", "Имя", "Отчество", "Логин", "Пароль"],
        creds.map((c) => [c.l_name, c.f_name, c.m_name ?? "", c.login, c.password]),
      );
      setGenNote(`Сгенерировано и скачано: ${creds.length}.`);
    } catch (err) {
      setGenNote(err instanceof ApiError ? err.message : "Ошибка генерации");
    } finally {
      setGenBusy(false);
    }
  }

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">Не удалось загрузить детей.</div>
    );
  }
  if (!items) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const shown = filter === "all" ? items : items.filter((c) => c.shifts.includes(filter));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Дети ({shown.length})</h2>
        <Button onClick={() => setAdding((v) => !v)} className="px-3 py-1.5 text-sm">
          {adding ? "Отмена" : "Добавить ребёнка"}
        </Button>
      </div>

      {adding && (
        <CreateChildForm
          onCreated={(c) => {
            setItems((cur) => (cur ? sortByName([...cur, c]) : [c]));
            setAdding(false);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
        <label className="text-[13px] text-[var(--color-text-muted)]">Смена:</label>
        <select
          className={inputCls}
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value === "all" ? "all" : Number(e.target.value))
          }
        >
          <option value="all">Все смены</option>
          {shifts.map((s) => (
            <option key={s.shift_id} value={s.shift_id}>
              {s.shift_id} · {s.name ?? "—"} ({s.child_count})
            </option>
          ))}
        </select>
        <Button onClick={generate} disabled={genBusy} className="px-3 py-1.5 text-sm">
          {genBusy ? "Генерация…" : "Сгенерировать пароли и скачать CSV"}
        </Button>
        {genNote && (
          <span className="text-xs text-[var(--color-text-muted)]">{genNote}</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-3 py-2 font-medium">Фамилия</th>
              <th className="px-3 py-2 font-medium">Имя</th>
              <th className="px-3 py-2 font-medium">Отчество</th>
              <th className="px-3 py-2 font-medium">Логин</th>
              <th className="px-3 py-2 font-medium">Смены</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <ChildRow
                key={c.id}
                child={c}
                onUpdated={(u) =>
                  setItems((cur) =>
                    cur ? cur.map((x) => (x.id === u.id ? u : x)) : cur,
                  )
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateChildForm({
  onCreated,
}: {
  onCreated: (c: ChildAccount) => void;
}) {
  const [form, setForm] = useState({
    l_name: "",
    f_name: "",
    m_name: "",
    login: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const c = await childrenApi.create({
        l_name: form.l_name,
        f_name: form.f_name,
        m_name: form.m_name || null,
        login: form.login,
        password: form.password,
      });
      onCreated(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка создания");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <input className={inputCls} placeholder="Фамилия" value={form.l_name} onChange={(e) => set("l_name", e.target.value)} />
      <input className={inputCls} placeholder="Имя" value={form.f_name} onChange={(e) => set("f_name", e.target.value)} />
      <input className={inputCls} placeholder="Отчество" value={form.m_name} onChange={(e) => set("m_name", e.target.value)} />
      <input className={inputCls} placeholder="Логин" value={form.login} onChange={(e) => set("login", e.target.value)} />
      <input className={inputCls} placeholder="Пароль" value={form.password} onChange={(e) => set("password", e.target.value)} />
      <Button onClick={submit} disabled={busy} className="px-3 py-1.5 text-sm">
        Создать
      </Button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}

function ChildRow({
  child,
  onUpdated,
}: {
  child: ChildAccount;
  onUpdated: (c: ChildAccount) => void;
}) {
  const [f, setF] = useState(child);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pass, setPass] = useState<string | null>(null);

  const changed =
    f.l_name !== child.l_name ||
    f.f_name !== child.f_name ||
    (f.m_name ?? "") !== (child.m_name ?? "") ||
    f.login !== child.login;

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      onUpdated(
        await childrenApi.update(child.id, {
          l_name: f.l_name,
          f_name: f.f_name,
          m_name: f.m_name || null,
          login: f.login,
        }),
      );
      setNote("сохранено");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!pass || pass.length < 6) {
      setNote("пароль ≥6 символов");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await childrenApi.setPassword(child.id, pass);
      setPass(null);
      setNote("пароль изменён");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-[var(--color-border)] align-top">
      <td className="px-3 py-1.5">
        <input className={`${inputCls} w-32`} value={f.l_name} onChange={(e) => setF({ ...f, l_name: e.target.value })} />
      </td>
      <td className="px-3 py-1.5">
        <input className={`${inputCls} w-28`} value={f.f_name} onChange={(e) => setF({ ...f, f_name: e.target.value })} />
      </td>
      <td className="px-3 py-1.5">
        <input className={`${inputCls} w-28`} value={f.m_name ?? ""} onChange={(e) => setF({ ...f, m_name: e.target.value })} />
      </td>
      <td className="px-3 py-1.5">
        <input className={`${inputCls} w-28`} value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} />
      </td>
      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">
        {child.shifts.length ? child.shifts.join(", ") : "—"}
      </td>
      <td className="px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={busy || !changed} className="px-2.5 py-1 text-xs">
            Сохранить
          </Button>
          {pass === null ? (
            <Button onClick={() => setPass("")} disabled={busy} className="px-2.5 py-1 text-xs">
              Пароль
            </Button>
          ) : (
            <>
              <input className={`${inputCls} w-28`} placeholder="Новый пароль" value={pass} onChange={(e) => setPass(e.target.value)} />
              <Button onClick={savePassword} disabled={busy} className="px-2.5 py-1 text-xs">
                OK
              </Button>
            </>
          )}
          {note && <span className="text-xs text-[var(--color-text-muted)]">{note}</span>}
        </div>
      </td>
    </tr>
  );
}
