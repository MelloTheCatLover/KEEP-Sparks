// Mirror of server types/children.ts.
export interface ChildAccount {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  created_at: string;
  shifts: number[];
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

export interface GeneratedCredential {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  password: string;
}
