export type Role = "admin" | "child";

// Safe user shape returned to clients. Never includes `passwd`.
export interface User {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  role: Role;
  // Пускать ли на сайт, пока он на техобслуживании (у админа всегда true по
  // роли, флаг нужен ребёнку).
  maintenance_bypass: boolean;
  created_at: string;
  updated_at: string;
}
