import { useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { downloadCsv } from "../../shared/lib/csv";
import { shiftsApi } from "../shifts/shifts-api";
import type { CreateShiftResult } from "../shifts/types";

const inputCls =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] outline-none focus:border-[var(--color-brand)]";

// Start-of-shift flow: enter the shift number, name and dates, paste the roster
// of names, and the shift is created (out of the ranking until its results are
// loaded) with numbers assigned. Number 1 is the previous shift's reality-show
// winner if present; otherwise numbering starts at 2.
export function LookupPage() {
  const [shiftId, setShiftId] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateShiftResult | null>(null);

  const names = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const canSubmit =
    /^\d+$/.test(shiftId) && start !== "" && end !== "" && names.length > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await shiftsApi.create({
          shift_id: Number(shiftId),
          name: name.trim() || null,
          start_date: start,
          end_date: end,
          names,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать смену");
    } finally {
      setBusy(false);
    }
  }

  function downloadNumbers() {
    if (!result) return;
    downloadCsv(
      `numbers-shift${result.shift_id}.csv`,
      ["№", "Фамилия", "Имя", "Отчество", "Искры", "Победитель прошлой смены"],
      result.numbers.map((n) => [
        String(n.number),
        n.l_name,
        n.f_name,
        n.m_name ?? "",
        String(n.sparks),
        n.is_prev_winner ? "да" : "",
      ]),
    );
  }

  function downloadCreds() {
    if (!result) return;
    downloadCsv(
      `passwords-shift${result.shift_id}.csv`,
      ["Фамилия", "Имя", "Отчество", "Логин", "Пароль"],
      result.credentials.map((c) => [
        c.l_name,
        c.f_name,
        c.m_name ?? "",
        c.login,
        c.password,
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-1 text-sm font-semibold">Генерация номеров</h2>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          Создаёт смену и раздаёт номера. Смена пока не влияет на общий рейтинг —
          загрузите итоговую таблицу искр после её окончания.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            Номер смены
            <input
              className={`${inputCls} w-24`}
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="125"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            Название
            <input
              className={`${inputCls} w-48`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="необязательно"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            Начало
            <input
              type="date"
              className={inputCls}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            Окончание
            <input
              type="date"
              className={inputCls}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>

        <p className="mt-3 mb-1 text-xs text-[var(--color-text-muted)]">
          Список детей — по одному в строке (Фамилия Имя Отчество).
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"Иванов Иван Иванович\nПетрова Мария Сергеевна"}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[13px] outline-none focus:border-[var(--color-brand)]"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button
            onClick={submit}
            disabled={busy || !canSubmit}
            className="px-3 py-1.5 text-sm"
          >
            {busy ? "Создаю…" : "Создать смену и номера"}
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            {names.length} имён
          </span>
          {error && (
            <span className="text-xs text-[var(--color-danger)]">{error}</span>
          )}
        </div>
      </div>

      {result && (
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold">
                Смена {result.shift_id} создана · {result.numbers.length} номеров
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {result.winner
                  ? `№1 — победитель смены ${result.previous_shift_id}: ${result.winner.l_name} ${result.winner.f_name}` +
                    (result.winner_in_list ? "" : " (нет в списке → нумерация с №2)")
                  : `Победитель прошлой смены не найден → нумерация с №2`}
                {result.created > 0 && ` · создано аккаунтов: ${result.created}`}
                {result.reused > 0 && ` · найдено: ${result.reused}`}
              </p>
            </div>
            <div className="flex gap-2">
              {result.credentials.length > 0 && (
                <Button onClick={downloadCreds} className="px-3 py-1.5 text-sm">
                  Пароли CSV
                </Button>
              )}
              <Button onClick={downloadNumbers} className="px-3 py-1.5 text-sm">
                Номера CSV
              </Button>
            </div>
          </div>

          {result.skipped.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-danger)]">
              Пропущены строки: {result.skipped.join("; ")}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px] whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)]">
                  <th className="px-4 py-1.5 font-medium">№</th>
                  <th className="px-3 py-1.5 font-medium">Ребёнок</th>
                  <th className="px-3 py-1.5 text-right font-medium">Искры</th>
                </tr>
              </thead>
              <tbody>
                {result.numbers.map((n) => (
                  <tr
                    key={n.user_id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-1.5 font-semibold">
                      {n.number}
                      {n.is_prev_winner && (
                        <span
                          className="ml-1.5 text-xs text-[var(--color-brand)]"
                          title="Победитель прошлой смены"
                        >
                          ★
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {n.l_name} {n.f_name} {n.m_name ?? ""}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[var(--color-text-muted)]">
                      {n.sparks.toLocaleString("ru-RU")}
                    </td>
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
