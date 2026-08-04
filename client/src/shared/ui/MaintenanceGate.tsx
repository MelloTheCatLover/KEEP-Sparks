import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "../../features/auth/AuthContext";

const POLL_MS = 30000; // как быстро сайт сам оживёт после снятия флага

export interface AppState {
  maintenance: boolean;
  message: string;
}

// Техобслуживание. Флаг живёт на сервере, поэтому закрытие не зависит от того,
// что у ребёнка в браузере: API всё равно отвечает 503, а эта заглушка просто
// объясняет почему.
//
// Админ сайт видит целиком — иначе снять флаг было бы неоткуда, — но с полосой
// сверху, чтобы не забыть, что для детей закрыто. Ребёнок с пропуском
// (`maintenance_bypass`) тоже проходит: API его пускает, заглушка была бы враньём.
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get<AppState>("/state")
        .then((s) => active && setState(s))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!state?.maintenance) return <>{children}</>;

  if (user?.role === "admin" || user?.maintenance_bypass) {
    return (
      <>
        <div className="sticky top-0 z-50 bg-[var(--color-warning)] px-4 py-1.5 text-center text-[13px] font-medium text-black">
          {user?.role === "admin"
            ? "Сайт на техобслуживании — дети его сейчас не видят"
            : "Сайт на техобслуживании — тебе открыт доступ"}
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="text-5xl" aria-hidden>
          🔧
        </div>
        <h1 className="mt-4 text-xl font-semibold">Технические работы</h1>
        <p className="mt-2 text-[15px] text-[var(--color-text-muted)]">
          {state.message}
        </p>
        <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">
          Страница откроется сама, как только всё починим.
        </p>
      </div>
    </div>
  );
}
