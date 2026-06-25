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
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-semibold">Искры</h1>
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
        <Button onClick={logout}>Выйти</Button>
      </header>
      <Outlet />
    </div>
  );
}
