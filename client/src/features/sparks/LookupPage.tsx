import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { downloadSheet } from "../../shared/xlsx";
import { sparksApi } from "./sparks-api";
import { ACHIEVEMENT_COLUMNS } from "./columns";
import type { LookupRow } from "./types";

// Paste a list of full names, get each child's sparks and achievement
// breakdown, then download it as an .xlsx. Names with no match are flagged.
export function LookupPage() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<LookupRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setRows(await sparksApi.lookup(names));
    } catch {
      setError("Не удалось сформировать список.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!rows) return;
    const data = rows.map((r) => {
      const row: Record<string, string | number> = {
        ФИО: r.input,
        Найден: r.entry ? "да" : "нет",
        Искры: r.entry?.sparks ?? "",
        Ранг: r.entry?.rank ?? "",
      };
      for (const c of ACHIEVEMENT_COLUMNS) {
        row[c.full] = r.entry ? r.entry.counts[c.key] ?? 0 : "";
      }
      return row;
    });
    downloadSheet("sparks.xlsx", "Искры", data);
  }

  const found = rows?.filter((r) => r.entry).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-2 text-sm font-semibold">Генерация номеров</h2>
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">
          Вставьте ФИО детей — по одному в строке.
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
            disabled={busy || names.length === 0}
            className="px-3 py-1.5 text-sm"
          >
            {busy ? "Считаю…" : "Сформировать"}
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            {names.length} имён
          </span>
          {error && (
            <span className="text-xs text-[var(--color-danger)]">{error}</span>
          )}
        </div>
      </div>

      {rows && (
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <h2 className="text-sm font-semibold">
              Найдено {found} из {rows.length}
            </h2>
            <Button onClick={download} className="px-3 py-1.5 text-sm">
              Скачать xlsx
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)]">
                  <th className="px-3 py-1.5 font-medium">ФИО</th>
                  <th className="px-3 py-1.5 text-right font-medium">Искры</th>
                  {ACHIEVEMENT_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      title={c.full}
                      className="px-2 py-1.5 text-right font-medium"
                    >
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-3 py-1.5">
                      {r.input}
                      {!r.entry && (
                        <span className="ml-2 text-xs text-[var(--color-danger)]">
                          не найден
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-[var(--color-brand)]">
                      {r.entry ? r.entry.sparks.toLocaleString("ru-RU") : "—"}
                    </td>
                    {ACHIEVEMENT_COLUMNS.map((c) => {
                      const v = r.entry?.counts[c.key] ?? 0;
                      return (
                        <td
                          key={c.key}
                          className={
                            "px-2 py-1.5 text-right " +
                            (r.entry && v
                              ? ""
                              : "text-[var(--color-text-muted)] opacity-40")
                          }
                        >
                          {r.entry ? v : "—"}
                        </td>
                      );
                    })}
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
