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
