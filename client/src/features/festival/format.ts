// Общее форматирование фестиваля: экран показа, судья и админка показывают
// время одинаково.

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

// Разбор времени, набранного руками: «3:42», «3.42» или просто секунды.
// undefined — не разобралось, null — пусто (вернуться к посчитанному).
export function parseClock(text: string): number | null | undefined {
  const raw = text.trim().replace(",", ":").replace(".", ":");
  if (raw === "") return null;
  const m = /^(\d{1,3})(?::(\d{1,2}))?$/.exec(raw);
  if (!m) return undefined;
  const first = Number(m[1]);
  if (m[2] === undefined) return first;
  const secs = Number(m[2]);
  if (secs > 59) return undefined;
  return first * 60 + secs;
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

// Палитра для быстрого выбора руками: те же цвета, что раздаются командам,
// плюс явно отличающиеся друг от друга на синем фоне экрана показа. Судья
// тыкает в кружок, а не набирает код.
export const NUMBER_PALETTE = [
  "#e40079", // магента
  "#ff5a3c", // коралл
  "#ffb400", // янтарь
  "#ffe600", // жёлтый
  "#72cc25", // лайм
  "#00c48c", // мята
  "#1fb2f1", // циан
  "#2b6bff", // синий
  "#7a2fc4", // фиолет
  "#ffffff", // белый
];

export function teamColor(team: string | null): string {
  if (!team) return "#a9c4e8";
  let hash = 0;
  for (let i = 0; i < team.length; i++) {
    hash = (hash * 31 + team.charCodeAt(i)) % 100000;
  }
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}

// Цвет номера ↔ HSL. Судья крутит тон/насыщенность/яркость, хранится и
// рисуется всё равно #RRGGBB — формат один на админку, экран и базу.
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return { h: 0, s: 0, l: 100 };
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return { h: (h + 360) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs((((h % 360) + 360) / 60) % 2 - 1));
  const m = lig - c / 2;
  const hue = (((h % 360) + 360) % 360) / 60;
  const [r, g, b] =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  const byte = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}
