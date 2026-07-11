import { useState } from "react";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { downloadCsv } from "../../shared/lib/csv";
import { parseSheet } from "../../shared/xlsx";
import { shiftsApi } from "../shifts/shifts-api";
import type { CreateShiftResult, RosterRow } from "../shifts/types";

const inputCls =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px] outline-none focus:border-[var(--color-brand)]";

// Map one parsed spreadsheet row (headers: Участник / Пол / Дата рождения /
// Рост / Аллергия / Родитель / Телефон) to a roster row.
function mapSheetRow(r: Record<string, string>): RosterRow | null {
  const name = (r["Участник"] ?? r["ФИО"] ?? "").trim();
  if (!name) return null;
  const h = Number(r["Рост"]);
  return {
    name,
    gender: r["Пол"] || null,
    date_of_birth: r["Дата рождения"] || null,
    height: Number.isFinite(h) && h > 0 ? h : null,
    allergy: r["Аллергия"] || null,
    parent: r["Родитель"] || null,
    phone: r["Телефон"] || null,
  };
}

// Start-of-shift flow: enter the shift number, name and dates, then either
// import the shift info table (.xlsx) or paste a plain name list. The shift is
// created out of the ranking (results loaded later) with numbers assigned:
// №1 = previous shift's reality-show winner if present, else numbering from 2.
export function LookupPage() {
  const [shiftId, setShiftId] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [text, setText] = useState("");
  const [fileRows, setFileRows] = useState<RosterRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateShiftResult | null>(null);

  const pastedNames = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const roster: RosterRow[] =
    fileRows ?? pastedNames.map((n) => ({ name: n }));

  const canSubmit =
    /^\d+$/.test(shiftId) && start !== "" && end !== "" && roster.length > 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const parsed = (await parseSheet(file))
        .map(mapSheetRow)
        .filter((r): r is RosterRow => r !== null);
      if (parsed.length === 0) {
        setError("В файле не найдено строк с колонкой «Участник».");
        return;
      }
      setFileRows(parsed);
      setFileName(file.name);
    } catch {
      setError("Не удалось прочитать файл.");
    }
  }

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
          roster,
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
      ["№", "Фамилия", "Имя", "Отчество", "Возраст", "Искры", "Новенький", "Победитель"],
      result.numbers.map((n) => [
        String(n.number),
        n.l_name,
        n.f_name,
        n.m_name ?? "",
        n.age != null ? String(n.age) : "",
        String(n.sparks),
        n.is_new ? "да" : "",
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

  const newCount = result?.numbers.filter((n) => n.is_new).length ?? 0;

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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-[var(--radius-sm)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-brand)] hover:underline">
            Импорт таблицы (.xlsx)
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {fileRows ? (
            <span className="text-xs text-[var(--color-text-muted)]">
              {fileName} · {fileRows.length} детей с инфо
              <button
                className="ml-2 text-[var(--color-danger)]"
                onClick={() => {
                  setFileRows(null);
                  setFileName(null);
                }}
              >
                убрать
              </button>
            </span>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">
              колонки: Участник, Пол, Дата рождения, Рост, Аллергия, Родитель, Телефон
            </span>
          )}
        </div>

        {!fileRows && (
          <>
            <p className="mt-3 mb-1 text-xs text-[var(--color-text-muted)]">
              …или список вручную — по одному в строке (Фамилия Имя Отчество).
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"Иванов Иван Иванович\nПетрова Мария Сергеевна"}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[13px] outline-none focus:border-[var(--color-brand)]"
            />
          </>
        )}

        <div className="mt-2 flex items-center gap-3">
          <Button
            onClick={submit}
            disabled={busy || !canSubmit}
            className="px-3 py-1.5 text-sm"
          >
            {busy ? "Создаю…" : "Создать смену и номера"}
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            {roster.length} детей
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
                Смена {result.shift_id} · {result.numbers.length} детей
                {result.average_age != null && (
                  <span className="ml-2 font-normal text-[var(--color-text-muted)]">
                    средний возраст {result.average_age}
                  </span>
                )}
                {newCount > 0 && (
                  <span className="ml-2 font-normal text-[var(--color-brand)]">
                    новеньких {newCount}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {result.winner
                  ? `№1 — победитель смены ${result.previous_shift_id}: ${result.winner.l_name} ${result.winner.f_name}` +
                    (result.winner_in_list ? "" : " (нет в списке → нумерация с №2)")
                  : "Победитель прошлой смены не найден → нумерация с №2"}
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
                  <th className="px-3 py-1.5 font-medium">Возраст</th>
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
                      {n.is_new && (
                        <span className="ml-2 rounded-[var(--radius-sm)] border border-[var(--color-brand)] px-1.5 py-0.5 text-[11px] text-[var(--color-brand)]">
                          новенький
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--color-text-muted)]">
                      {n.age ?? "—"}
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
