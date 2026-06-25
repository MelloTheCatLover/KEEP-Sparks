import { Navigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";
import { SparksPanel } from "../sparks/SparksPanel";

// Child home. Admins are sent to the admin area.
export function HomePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  if (user.role === "admin") return <Navigate to="/admin" replace />;

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
      <SparksPanel />
    </div>
  );
}
