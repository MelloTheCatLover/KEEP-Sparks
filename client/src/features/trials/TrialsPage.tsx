import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { parseSheetCells } from "../../shared/xlsx";
import { trialsApi } from "./trials-api";
import { parseCellsTable, parseText, type ParsedTable } from "./parse";
import type { Trial, TrialBoard, TrialRowMatch, TrialRowStatus } from "./types";

// Вкладка «Испытания»: внутренняя игра смены со своими баллами («Разбитый
// парк»). Испытание = день + название, баллы — таблицей «номер ФИО баллы».
// Дети видят испытание только после галочки «открыто».

function fio(m: { l_name: string; f_name: string; m_name: string | null }) {
  return `${m.l_name} ${m.f_name} ${m.m_name ?? ""}`.trim();
}

function pts(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

type Run = (action: () => Promise<TrialBoard>) => Promise<void>;

export function TrialsPage() {
  const { id } = useParams();
  const shiftId = Number(id);
  const [board, setBoard] = useState<TrialBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isInteger(shiftId)) return;
    let active = true;
    trialsApi
      .board(shiftId)
      .then((b) => active && setBoard(b))
      .catch(() => active && setError("Не удалось загрузить смену."));
    return () => {
      active = false;
    };
  }, [shiftId]);

  // Каждая правка возвращает доску целиком — состояние одно, склеивать нечего.
  const run: Run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      setBoard(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  };

  if (error && !board) {
    return <div className="text-[var(--color-danger)]">{error}</div>;
  }
  if (!board) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const target = board.trials.find((t) => t.id === uploading) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <Link
        to={`/admin/shifts/${shiftId}`}
        className="text-sm text-[var(--color-brand)]"
      >
        ← Смена {shiftId}
      </Link>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">
          Испытания · {board.shift_id} {board.name ?? ""}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {board.start_date} – {board.end_date} · дней: {board.days} ·
          участников: {board.members.length}
        </p>
      </div>

      {error && (
        <div className="text-[13px] text-[var(--color-danger)]">{error}</div>
      )}

      <CreateForm board={board} busy={busy} run={run} />
      <TrialList
        board={board}
        busy={busy}
        run={run}
        uploading={uploading}
        onUpload={setUploading}
      />
      {target && (
        <UploadPanel
          key={target.id}
          board={board}
          trial={target}
          onDone={(b) => setBoard(b)}
          onClose={() => setUploading(null)}
        />
      )}
      <Standings board={board} />
    </div>
  );
}

function CreateForm({
  board,
  busy,
  run,
}: {
  board: TrialBoard;
  busy: boolean;
  run: Run;
}) {
  const [day, setDay] = useState(1);
  const [title, setTitle] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <select
        value={day}
        onChange={(e) => setDay(Number(e.target.value))}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
      >
        {Array.from({ length: board.days }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            день {d}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="название испытания"
        className="min-w-48 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[13px]"
      />
      <Button
        disabled={busy || title.trim() === ""}
        onClick={() =>
          run(async () => {
            const b = await trialsApi.create(board.shift_id, day, title);
            setTitle("");
            return b;
          })
        }
        className="px-2.5 py-1 text-xs"
      >
        Добавить испытание
      </Button>
    </div>
  );
}

function TrialList({
  board,
  busy,
  run,
  uploading,
  onUpload,
}: {
  board: TrialBoard;
  busy: boolean;
  run: Run;
  uploading: number | null;
  onUpload: (id: number | null) => void;
}) {
  if (board.trials.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] shadow-[var(--shadow-card)]">
        Испытаний пока нет.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <table className="w-full text-[13px]">
        <thead className="text-left text-[var(--color-text-muted)]">
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-2 font-medium">День</th>
            <th className="px-2 py-2 font-medium">Испытание</th>
            <th className="px-2 py-2 font-medium">С баллами</th>
            <th className="px-2 py-2 font-medium">Открыто детям</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {board.trials.map((t) => (
            <tr
              key={t.id}
              className={
                "border-b border-[var(--color-border)] last:border-0 " +
                (uploading === t.id ? "bg-[var(--color-bg)]" : "")
              }
            >
              <td className="px-4 py-2">{t.day}</td>
              <td className="px-2 py-2">{t.title}</td>
              <td className="px-2 py-2">
                {t.scored} / {board.members.length}
              </td>
              <td className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={t.published}
                  disabled={busy}
                  onChange={(e) =>
                    run(() =>
                      trialsApi.update(board.shift_id, t.id, {
                        published: e.target.checked,
                      }),
                    )
                  }
                />
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <button
                  onClick={() => onUpload(uploading === t.id ? null : t.id)}
                  className="mr-3 text-[var(--color-brand)]"
                >
                  Загрузить баллы
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      !confirm(
                        `Удалить «${t.title}» (день ${t.day}) вместе с баллами?`,
                      )
                    )
                      return;
                    if (uploading === t.id) onUpload(null);
                    run(() => trialsApi.remove(board.shift_id, t.id));
                  }}
                  className="text-[var(--color-danger)]"
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS: Record<TrialRowStatus, { label: string; color: string }> = {
  ok: { label: "найден", color: "var(--color-success)" },
  mismatch: { label: "ФИО не сходится", color: "var(--color-warning)" },
  unknown: { label: "не найден", color: "var(--color-danger)" },
  ambiguous: { label: "несколько похожих", color: "var(--color-danger)" },
  duplicate: { label: "повтор", color: "var(--color-danger)" },
};

// Загрузка баллов одного испытания: текст или xlsx → проверка на сервере →
// сохранение. Сохранение заменяет баллы испытания целиком.
function UploadPanel({
  board,
  trial,
  onDone,
  onClose,
}: {
  board: TrialBoard;
  trial: Trial;
  onDone: (b: TrialBoard) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedTable | null>(null);
  const [preview, setPreview] = useState<TrialRowMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function check(table: ParsedTable): Promise<void> {
    setParsed(table);
    setPreview(null);
    setSaved(false);
    setError(null);
    if (table.rows.length === 0) {
      setError("Не нашлось ни одной строки «номер ФИО баллы».");
      return;
    }
    setBusy(true);
    try {
      const res = await trialsApi.upload(
        board.shift_id,
        trial.id,
        table.rows,
        false,
      );
      setPreview(res.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File): Promise<void> {
    try {
      const cells = await parseSheetCells(file);
      const table = parseCellsTable(cells);
      setText(
        table.rows
          .map((r) => [r.number ?? "", r.name, r.points].join("\t"))
          .join("\n"),
      );
      await check(table);
    } catch {
      setError("Не удалось прочитать файл.");
    }
  }

  async function save(): Promise<void> {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await trialsApi.upload(
        board.shift_id,
        trial.id,
        parsed.rows,
        true,
      );
      setPreview(res.rows);
      onDone(res.board);
      if (res.applied) setSaved(true);
      else setError("Есть строки с ошибками — ничего не сохранено.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  const blocked =
    preview?.some((r) => r.status !== "ok" && r.status !== "mismatch") ?? true;
  const warnings = preview?.filter((r) => r.status === "mismatch").length ?? 0;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">
          Баллы: день {trial.day} · {trial.title}
        </h3>
        <button
          onClick={onClose}
          className="text-[13px] text-[var(--color-text-muted)]"
        >
          закрыть
        </button>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setSaved(false);
          }}
          rows={8}
          placeholder={
            "Вставьте таблицу — по строке на ребёнка: номер, ФИО, баллы.\n" +
            "1\tИванов Иван\t12\n2 Петрова Мария 7,5\nСидоров Пётр 10   ← без номера ищется по ФИО"
          }
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-mono text-[13px]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || text.trim() === ""}
            onClick={() => check(parseText(text))}
            className="px-2.5 py-1 text-xs"
          >
            Проверить
          </Button>
          <label className="cursor-pointer text-[13px] text-[var(--color-brand)]">
            или загрузить .xlsx
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onFile(f);
              }}
            />
          </label>
          {trial.scored > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              сохранение заменит все {trial.scored} текущих баллов испытания
              {trial.published && " — дети увидят новые сразу"}
            </span>
          )}
        </div>

        {error && (
          <div className="text-[13px] text-[var(--color-danger)]">{error}</div>
        )}

        {parsed && parsed.skipped.length > 0 && (
          <div className="text-[13px] text-[var(--color-warning)]">
            Пропущены непонятые строки:{" "}
            {parsed.skipped.map((s) => `${s.line} («${s.text}»)`).join(", ")}
          </div>
        )}

        {preview && (
          <>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[var(--color-text-muted)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">В таблице</th>
                  <th className="py-1 pr-2 font-medium">Баллы</th>
                  <th className="py-1 pr-2 font-medium">В смене</th>
                  <th className="py-1 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr
                    key={r.line}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="py-1 pr-2">{r.number ?? "—"}</td>
                    <td className="py-1 pr-2">{r.name}</td>
                    <td className="py-1 pr-2">{pts(r.points)}</td>
                    <td className="py-1 pr-2">
                      {r.matched_name
                        ? `${r.matched_number ?? "—"} · ${r.matched_name}`
                        : "—"}
                    </td>
                    <td
                      className="py-1"
                      style={{ color: STATUS[r.status].color }}
                    >
                      {STATUS[r.status].label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || blocked || saved}
                onClick={save}
                className="px-2.5 py-1 text-xs"
              >
                Сохранить {preview.length} строк
              </Button>
              {saved ? (
                <span className="text-[13px] text-[var(--color-success)]">
                  Сохранено.
                  {!trial.published && " Детям откроется после галочки «Открыто»."}
                </span>
              ) : blocked ? (
                <span className="text-[13px] text-[var(--color-danger)]">
                  Исправьте красные строки и проверьте заново.
                </span>
              ) : (
                warnings > 0 && (
                  <span className="text-[13px] text-[var(--color-warning)]">
                    {warnings} строк с несовпадающим ФИО сохранятся по номеру.
                  </span>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Итог смены по всем испытаниям, включая неоткрытые: сверить до того, как
// увидят дети.
function Standings({ board }: { board: TrialBoard }) {
  if (board.trials.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">Итог смены</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Считаются все испытания, в том числе неоткрытые (отмечены *). Дети
          видят итог только по открытым.
        </p>
      </div>
      <table className="w-full text-[13px]">
        <thead className="text-left text-[var(--color-text-muted)]">
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-2 font-medium">Место</th>
            <th className="px-2 py-2 font-medium">№</th>
            <th className="px-2 py-2 font-medium">ФИО</th>
            {board.trials.map((t) => (
              <th
                key={t.id}
                className="px-2 py-2 font-medium whitespace-nowrap"
                title={t.title}
              >
                д{t.day} · {t.title}
                {!t.published && "*"}
              </th>
            ))}
            <th className="px-4 py-2 font-medium">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {board.members.map((m) => (
            <tr
              key={m.user_id}
              className="border-b border-[var(--color-border)] last:border-0"
            >
              <td className="px-4 py-1.5">{m.place}</td>
              <td className="px-2 py-1.5">{m.number ?? "—"}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{fio(m)}</td>
              {board.trials.map((t) => {
                const v = m.scores[String(t.id)];
                return (
                  <td key={t.id} className="px-2 py-1.5">
                    {v === undefined ? "—" : pts(v)}
                  </td>
                );
              })}
              <td className="px-4 py-1.5 font-semibold">{pts(m.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
