import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../shared/api/client";
import { Button } from "../../shared/ui/Button";
import { useAuth } from "./AuthContext";
import { AuthShell, Field } from "./LoginPage";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    f_name: "",
    m_name: "",
    l_name: "",
    login: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({ ...form, m_name: form.m_name || null });
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось зарегистрироваться",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Регистрация">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Имя" value={form.f_name} onChange={(v) => set("f_name", v)} />
        <Field
          label="Отчество (необязательно)"
          value={form.m_name}
          onChange={(v) => set("m_name", v)}
        />
        <Field
          label="Фамилия"
          value={form.l_name}
          onChange={(v) => set("l_name", v)}
        />
        <Field label="Логин" value={form.login} onChange={(v) => set("login", v)} />
        <Field
          label="Пароль"
          type="password"
          value={form.password}
          onChange={(v) => set("password", v)}
        />
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Создаём…" : "Зарегистрироваться"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        Уже есть аккаунт?{" "}
        <Link to="/login" className="text-[var(--color-brand)]">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
