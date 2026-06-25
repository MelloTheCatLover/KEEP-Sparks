import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";
import { SparksPanel } from "../sparks/SparksPanel";

export function DashboardPage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Искры</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Привет, {user.f_name}!
          </p>
        </div>
        <Button onClick={logout}>Выйти</Button>
      </header>

      {user.role === "child" ? (
        <SparksPanel />
      ) : (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] text-[var(--color-text-muted)]">
          Админ-панель скоро.
        </div>
      )}
    </div>
  );
}
