import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { settingsApi } from "./settings-api";
import type { AppState, BypassUser } from "./settings-api";
import { settingLabel } from "./labels";
import type { Setting } from "./types";

// Техобслуживание: сайт закрывается для детей одним нажатием. Админу он
// остаётся доступен — иначе снять флаг было бы нечем.
function MaintenancePanel() {
  const [state, setState] = useState<AppState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    settingsApi
      .state()
      .then((s) => {
        if (!active) return;
        setState(s);
        setMessage(s.message);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function toggle(on: boolean): Promise<void> {
    setBusy(true);
    try {
      const next = await settingsApi.setMaintenance(on, message || null);
      setState(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Техническое обслуживание</h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {state?.maintenance ? "сайт закрыт для детей" : "сайт открыт"}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Что увидят дети на заглушке"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
        />
        <div className="flex items-center gap-2">
          <Button
            disabled={busy}
            onClick={() => toggle(!state?.maintenance)}
            className="px-3 py-1.5 text-xs"
          >
            {state?.maintenance ? "Открыть сайт" : "Увести на обслуживание"}
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            переключается сразу, пересборка не нужна
          </span>
        </div>
        <BypassList />
      </div>
    </div>
  );
}

// Пропуска: кому из детей сайт остаётся открытым на техобслуживании. Ввод
// руками, а не выбор из списка: детей несколько сотен, а пропуск дают одному-двум.
function BypassList() {
  const [items, setItems] = useState<BypassUser[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    settingsApi
      .bypass()
      .then((list) => active && setItems(list))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function add(): Promise<void> {
    if (query.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const user = await settingsApi.grantBypass(query);
      setItems((cur) =>
        cur.some((u) => u.id === user.id) ? cur : [...cur, user],
      );
      setQuery("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setBusy(true);
    try {
      await settingsApi.revokeBypass(id);
      setItems((cur) => cur.filter((u) => u.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-medium">Пускать на обслуживании</h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          Фамилия Имя или логин
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {items.length === 0 && (
          <li className="text-xs text-[var(--color-text-muted)]">
            Никого — сайт закрыт для всех детей.
          </li>
        )}
        {items.map((u) => (
          <li
            key={u.id}
            className="flex items-center gap-2 text-[13px]"
          >
            <span className="flex-1">
              {u.l_name} {u.f_name}
              <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                {u.login}
              </span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(u.id)}
              className="text-xs text-[var(--color-danger)] disabled:opacity-50"
            >
              Убрать
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Тарасова Дарья"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
        />
        <Button
          onClick={add}
          disabled={busy || query.trim() === ""}
          className="px-2.5 py-1 text-xs"
        >
          Добавить
        </Button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}

export function SettingsPage() {
  const [items, setItems] = useState<Setting[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    settingsApi
      .list()
      .then((s) => active && setItems(s))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  function onSaved(updated: Setting) {
    setItems((cur) =>
      cur ? cur.map((s) => (s.id === updated.id ? updated : s)) : cur,
    );
  }

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить настройки.
      </div>
    );
  }
  if (!items) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <MaintenancePanel />
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">Стоимость достижений</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Очки за единицу. Изменение пересчитывает рейтинг автоматически.
        </p>
      </div>
      <ul>
        {items.map((s) => (
          <SettingRow key={s.id} setting={s} onSaved={onSaved} />
        ))}
      </ul>
      </div>
    </div>
  );
}

function SettingRow({
  setting,
  onSaved,
}: {
  setting: Setting;
  onSaved: (s: Setting) => void;
}) {
  const [value, setValue] = useState(String(setting.value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 0;
  const changed = parsed !== setting.value;

  async function save() {
    if (!valid || !changed) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await settingsApi.updateValue(setting.id, parsed));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-1.5 text-[13px] first:border-t-0">
      <span className="flex-1">{settingLabel(setting.name)}</span>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-right outline-none focus:border-[var(--color-brand)]"
      />
      <Button
        onClick={save}
        disabled={busy || !valid || !changed}
        className="px-2.5 py-1 text-xs"
      >
        Сохранить
      </Button>
    </li>
  );
}
