// Общее форматирование фестиваля: экран показа, судья и админка показывают
// время одинаково.

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

// Цвет команды. Палитра фиксированная, команда попадает в неё по имени —
// одна и та же команда всегда одного цвета, без ручной настройки.
const TEAM_COLORS = [
  "#8b7cf6",
  "#3fbf82",
  "#e0a44b",
  "#5b8def",
  "#f2555a",
  "#40c4c4",
  "#d377d3",
  "#9fbf3f",
];

export function teamColor(team: string | null): string {
  if (!team) return "#8b8b94";
  let hash = 0;
  for (let i = 0; i < team.length; i++) {
    hash = (hash * 31 + team.charCodeAt(i)) % 100000;
  }
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}
