import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Вход">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field
          label="Логин"
          value={form.login}
          onChange={(v) => setForm({ ...form, login: v })}
        />
        <Field
          label="Пароль"
          type="password"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
        />
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Входим…" : "Войти"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        Логин и пароль выдаёт администратор.
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
      />
    </label>
  );
}
