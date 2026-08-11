import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { settingsApi } from "./settings-api";
import type { AppState } from "./settings-api";
import { settingLabel } from "./labels";
import type { PriceWindow, Setting } from "./types";

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
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [items, setItems] = useState<Setting[] | null>(null);
  const [window, setWindow] = useState<PriceWindow | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([settingsApi.list(), settingsApi.priceWindow()])
      .then(([s, w]) => {
        if (!active) return;
        setItems(s);
        setWindow(w);
      })
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
          Очки за единицу. Цена привязана к дате: смена считается по прайсу,
          действовавшему на день её начала, поэтому новая цена не трогает уже
          выданные искры.
          {window?.locked_until && (
            <>
              {" "}
              Прошлое заморожено по {window.locked_until} — новая цена может
              начинаться только позже.
            </>
          )}
          {window?.next_shift && (
            <>
              {" "}
              Ближайшая смена без выданных искр — {window.next_shift.shift_id}
              {window.next_shift.name ? ` «${window.next_shift.name}»` : ""} с{" "}
              {window.next_shift.start_date}.
            </>
          )}
        </p>
      </div>
      <ul>
        {items.map((s) => (
          <SettingRow
            key={s.id}
            setting={s}
            defaultDate={window?.next_shift?.start_date ?? ""}
            onSaved={onSaved}
          />
        ))}
      </ul>
      </div>
    </div>
  );
}

// Строка каталога: цена сегодня, цена будущих смен и история версий. Правка —
// это всегда «с такой-то даты»: поле даты обязательно, по умолчанию — начало
// ближайшей смены, которая ещё не отдавала искры.
function SettingRow({
  setting,
  defaultDate,
  onSaved,
}: {
  setting: Setting;
  defaultDate: string;
  onSaved: (s: Setting) => void;
}) {
  const [value, setValue] = useState(String(setting.value));
  const [from, setFrom] = useState(defaultDate);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 0 && from !== "";
  // Будущие версии видно отдельно: по ним понятно, что цена уже объявлена, но
  // ещё не наступила.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = setting.prices.filter((p) => p.valid_from > today);

  async function run(fn: () => Promise<Setting>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      onSaved(next);
      setValue(String(next.value));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-t border-[var(--color-border)] px-4 py-1.5 text-[13px] first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1">
          {settingLabel(setting.name)}
          {setting.effective_value !== setting.value && (
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              сейчас {setting.effective_value} → {setting.value} со следующих смен
            </span>
          )}
        </span>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-[var(--color-brand)]"
        >
          {open ? "Свернуть" : `История (${setting.prices.length})`}
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-right outline-none focus:border-[var(--color-brand)]"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          title="С какой даты действует цена (по дате начала смены)"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
        />
        <Button
          onClick={() => run(() => settingsApi.setPrice(setting.id, from, parsed))}
          disabled={busy || !valid}
          className="px-2.5 py-1 text-xs"
        >
          Задать с даты
        </Button>
      </div>

      {error && (
        <div className="mt-1 text-xs text-[var(--color-danger)]">{error}</div>
      )}

      {upcoming.length > 0 && !open && (
        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
          Объявлено вперёд:{" "}
          {upcoming.map((p) => `${p.value} с ${p.valid_from}`).join(", ")}
        </div>
      )}

      {open && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {setting.prices.map((p) => (
            <li
              key={p.valid_from}
              className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"
            >
              <span className="w-24">
                {p.valid_from === "1970-01-01" ? "изначально" : `с ${p.valid_from}`}
              </span>
              <span className="text-[var(--color-text)]">{p.value}</span>
              {p.valid_from > today && (
                <button
                  onClick={() =>
                    run(() => settingsApi.deletePrice(setting.id, p.valid_from))
                  }
                  disabled={busy}
                  className="text-[var(--color-danger)]"
                >
                  убрать
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
