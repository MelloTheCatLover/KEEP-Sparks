// Общее форматирование фестиваля: экран показа, судья и админка показывают
// время одинаково.

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

// Цвет номера: заданный руками, иначе по команде.
export function numberColor(
  color: string | null,
  team: string | null,
): string {
  return color ?? teamColor(team);
}

// Цвет команды. Палитра фиксированная, команда попадает в неё по имени —
// одна и та же команда всегда одного цвета, без ручной настройки.
const TEAM_COLORS = [
  "#e40079", // магента
  "#1fb2f1", // циан
  "#72cc25", // лайм
  "#ffb400", // янтарь
  "#7a2fc4", // фиолет
  "#0099d9",
  "#d0068a",
  "#589b10",
];

export function teamColor(team: string | null): string {
  if (!team) return "#a9c4e8";
  let hash = 0;
  for (let i = 0; i < team.length; i++) {
    hash = (hash * 31 + team.charCodeAt(i)) % 100000;
  }
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}
