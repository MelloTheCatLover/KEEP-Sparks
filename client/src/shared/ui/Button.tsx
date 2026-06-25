import type { ButtonHTMLAttributes } from "react";

// Brand-coloured primary button. Uses design tokens, never raw hex.
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={
        "rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-2 font-medium " +
        "text-[var(--color-brand-text)] transition-colors hover:bg-[var(--color-brand-hover)] " +
        "disabled:cursor-not-allowed disabled:opacity-60 " +
        className
      }
      {...props}
    />
  );
}
