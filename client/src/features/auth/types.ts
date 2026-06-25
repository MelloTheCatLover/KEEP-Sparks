// Mirror of server types/. Keep in sync with both sides on contract changes.
export type Role = "admin" | "child";

export interface User {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface LoginInput {
  login: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
