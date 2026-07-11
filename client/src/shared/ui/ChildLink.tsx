import { Link } from "react-router-dom";
import type { ReactNode } from "react";

// A child's name as a link to their personal page (admin view).
export function ChildLink({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={`/admin/children/${id}`}
      className={
        className ??
        "hover:text-[var(--color-brand)] hover:underline"
      }
    >
      {children}
    </Link>
  );
}
