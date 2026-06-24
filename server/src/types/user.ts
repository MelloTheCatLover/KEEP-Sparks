export type Role = "admin" | "child";

// Safe user shape returned to clients. Never includes `passwd`.
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
