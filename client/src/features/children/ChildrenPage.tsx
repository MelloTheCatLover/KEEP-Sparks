import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { childrenApi } from "./children-api";
import type { ChildAccount } from "./types";

const inputCls =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[13px] outline-none focus:border-[var(--color-brand)]";

export function ChildrenPage() {
  const [items, setItems] = useState<ChildAccount[] | null>(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    childrenApi
      .list()
      .then((c) => active && setItems(c))
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

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">Не удалось загрузить детей.</div>
    );
  }
  if (!items) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Дети ({items.length})</h2>
        <Button
          onClick={() => setAdding((v) => !v)}
          className="px-3 py-1.5 text-sm"
        >
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

      <div className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-3 py-2 font-medium">Фамилия</th>
              <th className="px-3 py-2 font-medium">Имя</th>
              <th className="px-3 py-2 font-medium">Отчество</th>
              <th className="px-3 py-2 font-medium">Логин</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
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
