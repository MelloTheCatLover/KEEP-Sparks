import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Искры</h1>
        <Button onClick={logout}>Выйти</Button>
      </header>
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
        <p className="text-[var(--color-text-muted)]">Вы вошли как</p>
        <p className="text-lg font-medium">
          {user.l_name} {user.f_name} {user.m_name ?? ""}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Логин: {user.login} · Роль: {user.role}
        </p>
      </div>
    </div>
  );
}
