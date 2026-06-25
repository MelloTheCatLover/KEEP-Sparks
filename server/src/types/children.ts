// Admin-facing child account (never includes passwd).
export interface ChildAccount {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  created_at: string;
}

export interface ChildInput {
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
}

export interface CreateChildInput extends ChildInput {
  password: string;
}
