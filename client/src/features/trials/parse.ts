import type { TrialScoreRow } from "./types";

// Разбор таблицы баллов «номер ФИО баллы» — вставленного текста или строк
// xlsx. Колонки угадываются по содержимому, а не по заголовку: первая клетка —
// номер, если это целое число, последняя числовая — баллы, всё между — ФИО.
// Номера может не быть вовсе, тогда ребёнок ищется по ФИО.

export interface ParsedTable {
  rows: TrialScoreRow[];
  // Строки, которые не похожи на «ФИО + баллы» (кроме шапки таблицы).
  skipped: { line: number; text: string }[];
}

function toNumber(cell: string): number | null {
  const s = cell.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function parseCells(cells: string[]): TrialScoreRow | null {
  const c = cells.map((x) => x.trim()).filter(Boolean);
  if (c.length < 2) return null;

  const points = toNumber(c[c.length - 1]);
  if (points === null) return null;

  let rest = c.slice(0, -1);
  let number: number | null = null;
  if (rest.length > 1 && /^\d+$/.test(rest[0])) {
    number = Number(rest[0]);
    rest = rest.slice(1);
  }
  const name = rest.join(" ").replace(/\s+/g, " ").trim();
  if (!name || toNumber(name) !== null) return null;
  return { number, name, points };
}

function parseLines(lines: string[][]): ParsedTable {
  const rows: TrialScoreRow[] = [];
  const skipped: ParsedTable["skipped"] = [];
  let header = true;
  lines.forEach((cells, i) => {
    if (cells.every((c) => c.trim() === "")) return;
    const row = parseCells(cells);
    if (row) rows.push(row);
    // Первая непонятая строка до всех данных — шапка таблицы, не ошибка.
    else if (rows.length > 0 || skipped.length > 0 || !header) {
      skipped.push({ line: i + 1, text: cells.join(" ").trim() });
    } else header = false;
  });
  return { rows, skipped };
}

// Текст: колонки по табу (копия из Excel/Google Таблиц) или «;», иначе по
// пробелам — тогда ФИО склеивается обратно из средних слов.
export function parseText(text: string): ParsedTable {
  return parseLines(
    text.split(/\r?\n/).map((line) =>
      /[\t;]/.test(line) ? line.split(/[\t;]/) : line.trim().split(/\s+/),
    ),
  );
}

export function parseCellsTable(table: string[][]): ParsedTable {
  return parseLines(table);
}
