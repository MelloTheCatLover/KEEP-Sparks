// JS mirror of tokens.css. Use for dynamic styles; static styling uses
// Tailwind classes or the CSS variables directly.
export const tokens = {
  color: {
    bg: "var(--color-bg)",
    surface: "var(--color-surface)",
    border: "var(--color-border)",
    text: "var(--color-text)",
    textMuted: "var(--color-text-muted)",
    brand: "var(--color-brand)",
    brandHover: "var(--color-brand-hover)",
    brandText: "var(--color-brand-text)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
    info: "var(--color-info)",
  },
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
  },
  shadow: {
    card: "var(--shadow-card)",
  },
} as const;
