import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";

// No token/user -> bounce to login. Waits for bootstrap to finish.
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

// Already logged in -> keep out of login/register.
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

// Admin-only area. Non-admins (children) are bounced home.
export function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)]">
      Загрузка…
    </div>
  );
}
