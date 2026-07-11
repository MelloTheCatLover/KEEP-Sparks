import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "../auth/AuthContext";
import { sparksApi } from "../sparks/sparks-api";
import type { MyBreakdown } from "../sparks/types";
import { SparksDashboard } from "./SparksDashboard";

export function HomePage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<MyBreakdown | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "child") return;
    let active = true;
    sparksApi
      .myBreakdown()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;
  if (user.role === "admin") return <Navigate to="/admin" replace />;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Искры</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Привет, {user.f_name}!
          </p>
        </div>
        <Button onClick={logout} className="px-3 py-1.5 text-sm">
          Выйти
        </Button>
      </header>

      {error && (
        <div className="text-[var(--color-danger)]">
          Не удалось загрузить статистику.
        </div>
      )}
      {!error && !data && (
        <div className="text-[var(--color-text-muted)]">Загрузка…</div>
      )}
      {data && <SparksDashboard data={data} />}
    </div>
  );
}
