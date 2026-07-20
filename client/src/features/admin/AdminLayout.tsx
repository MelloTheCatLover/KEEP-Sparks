import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";

const NAV: { to: string; label: string }[] = [
  { to: "/admin/ranking", label: "Рейтинг детей" },
  { to: "/admin/overview", label: "Общий рейтинг" },
  { to: "/admin/lookup", label: "Генерация номеров" },
  { to: "/admin/children", label: "Аккаунты" },
  { to: "/admin/winners", label: "Победители и финалисты" },
  { to: "/admin/contests", label: "КТП / КТБ" },
  { to: "/admin/people-of-shift", label: "Человек смены" },
  { to: "/admin/people-of-day", label: "Человек дня" },
  { to: "/admin/shifts", label: "Смены" },
  { to: "/admin/settings", label: "Настройки" },
];

export function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link to="/admin/ranking" className="text-lg font-semibold">
            Искры
          </Link>
          <Button onClick={logout} className="px-3 py-1.5 text-sm">
            Выйти
          </Button>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
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
