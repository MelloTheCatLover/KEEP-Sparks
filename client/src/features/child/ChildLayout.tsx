import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";

// Child area: read-only navigation over the same boards the admin sees.
const NAV: { to: string; label: string }[] = [
  { to: "/", label: "Мой профиль" },
  { to: "/my-shift", label: "Моя смена" },
  { to: "/board", label: "Рейтинг искр" },
  { to: "/winners", label: "Победители и финалисты" },
  { to: "/people-of-shift", label: "Человек смены" },
  { to: "/people-of-day", label: "Человек дня" },
];

export function ChildLayout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  // Admins have their own area; children stay here.
  if (user.role === "admin") return <Navigate to="/admin" replace />;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-lg font-semibold">
              Искры
            </Link>
            <p className="text-sm text-[var(--color-text-muted)]">
              Привет, {user.f_name}!
            </p>
          </div>
          <Button onClick={logout} className="px-3 py-1.5 text-sm">
            Выйти
          </Button>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                "rounded-[var(--radius-sm)] px-2.5 py-1 text-[13px] transition-colors " +
                (isActive
                  ? "bg-[var(--color-brand)] text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]")
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
