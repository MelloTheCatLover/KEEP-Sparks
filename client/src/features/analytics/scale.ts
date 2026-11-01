// Шкала искр: линейная честно показывает, как вершина отрывается от хвоста;
// логарифмическая раскрывает середину и хвост, где на линейной всё слипается.
export function sparksScale(max: number, log: boolean) {
  const top = Math.max(max, 1);
  return log
    ? (v: number) => Math.log10(1 + v) / Math.log10(1 + top)
    : (v: number) => v / top;
}

export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
