// Build a CSV and trigger a browser download. UTF-8 BOM so Excel reads Cyrillic.
function escape(field: string): string {
  return /[",\n;]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const lines = [headers, ...rows].map((r) => r.map(escape).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
