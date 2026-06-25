import { NavLink, Outlet } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/admin", label: "Рейтинг", end: true },
  { to: "/admin/settings", label: "Настройки", end: false },
];

export function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <h1 className="text-lg font-semibold">Искры</h1>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  isActive
                    ? "font-medium text-[var(--color-brand)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <Button onClick={logout} className="px-3 py-1.5 text-sm">
          Выйти
        </Button>
      </header>
      <Outlet />
    </div>
  );
}
