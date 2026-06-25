import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { clearToken, getToken, setToken } from "../../shared/api/client";
import { authApi } from "./auth-api";
import type { LoginInput, User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Only "loading" when there is a token to validate on mount.
  const [loading, setLoading] = useState(() => getToken() !== null);

  // Bootstrap: a stored token must still be valid. 401 -> drop it.
  useEffect(() => {
    if (!getToken()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(input: LoginInput): Promise<void> {
    const { token, user } = await authApi.login(input);
    setToken(token);
    setUser(user);
  }

  function logout(): void {
    clearToken();
    setUser(null);
  }

  async function refreshUser(): Promise<void> {
    setUser(await authApi.me());
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
