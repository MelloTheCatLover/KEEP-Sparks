// Lazy .xlsx download. SheetJS (~290 KB) is imported on demand so it never
// lands in the initial bundle. `rows` are plain objects keyed by column header;
// the key order defines the column order.
export async function downloadSheet(
  filename: string,
  sheetName: string,
  rows: Record<string, string | number>[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Read the first sheet of an .xlsx file into row objects keyed by trimmed
// header text. Cells come back as formatted strings (raw: false), so dates like
// "25.02.2011" stay as typed.
export async function parseSheet(
  file: File,
): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  return json.map((row) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      o[String(k).trim()] = String(v ?? "").trim();
    }
    return o;
  });
}
