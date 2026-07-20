import type { KtbStatus, KtpStatus } from "./types";

// Russian labels for the contest statuses, shared by the roster tags, the
// board and the exports.
export const KTP_LABEL: Record<KtpStatus, string> = {
  mvp: "МВП",
  winner: "Победитель",
  participant: "Участник",
  new: "Новенький",
};

export const KTB_LABEL: Record<KtbStatus, string> = {
  team_best: "Лучший в команде",
  winner: "Победитель",
  participant: "Участник",
  new: "Новенький",
};

// Tailwind classes for a status chip. "new" is muted; the rest use the brand
// accent, strongest for the top tier.
export function ktpChip(s: KtpStatus): string {
  if (s === "mvp") return "border-[var(--color-brand)] bg-[var(--color-brand)] text-white";
  if (s === "winner") return "border-[var(--color-brand)] text-[var(--color-brand)] font-semibold";
  if (s === "participant") return "border-[var(--color-border)]";
  return "border-[var(--color-border)] text-[var(--color-text-muted)]";
}

export function ktbChip(s: KtbStatus): string {
  if (s === "team_best") return "border-[var(--color-brand)] bg-[var(--color-brand)] text-white";
  if (s === "winner") return "border-[var(--color-brand)] text-[var(--color-brand)] font-semibold";
  if (s === "participant") return "border-[var(--color-border)]";
  return "border-[var(--color-border)] text-[var(--color-text-muted)]";
}
