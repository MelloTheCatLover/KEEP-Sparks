import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { settingsApi } from "./settings-api";
import { settingLabel } from "./labels";
import type { Setting } from "./types";

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
