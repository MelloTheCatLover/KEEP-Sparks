// Admin-facing child account (never includes passwd).
export interface ChildAccount {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  created_at: string;
  // Shift ids the child has achievements on (derived). Empty until rostered.
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

// Returned only at the moment passwords are generated — plaintext to hand out.
export interface GeneratedCredential {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  password: string;
}
