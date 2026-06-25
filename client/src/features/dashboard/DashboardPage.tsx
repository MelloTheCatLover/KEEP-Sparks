import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";
import { SparksPanel } from "../sparks/SparksPanel";
import { AdminRankingPanel } from "../sparks/AdminRankingPanel";

export function DashboardPage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <div className={`mx-auto p-6 ${isAdmin ? "max-w-4xl" : "max-w-2xl"}`}>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Искры</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Привет, {user.f_name}!
          </p>
        </div>
        <Button onClick={logout}>Выйти</Button>
      </header>

      {isAdmin ? <AdminRankingPanel /> : <SparksPanel />}
    </div>
  );
}
