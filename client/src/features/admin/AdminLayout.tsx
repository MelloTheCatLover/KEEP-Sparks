import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";

export function AdminLayout() {
  const { logout } = useAuth();
  const onHub = useLocation().pathname === "/admin";

  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-lg font-semibold">
            Искры
          </Link>
          {!onHub && (
            <Link to="/admin" className="text-sm text-[var(--color-brand)]">
              ← Разделы
            </Link>
          )}
        </div>
        <Button onClick={logout} className="px-3 py-1.5 text-sm">
          Выйти
        </Button>
      </header>
      <Outlet />
    </div>
  );
}
