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

// Full admin/internal profile of a child. Not surfaced in Sparks.
export interface ParentInfo {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  phone_number_1: string;
  phone_number_2: string | null;
}

export interface PersInfo {
  gender: string;
  date_of_birth: string;
  height: number;
}

export interface ChildDetails {
  pers: PersInfo | null;
  parents: ParentInfo[];
  allergies: string[];
}

// One admin overview row: account + full profile in a single payload.
export interface ChildOverview {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
  shifts: number[];
  gender: string | null;
  date_of_birth: string | null;
  height: number | null;
  parents: ParentInfo[];
  allergies: string[];
}

export interface ParentInput {
  f_name: string;
  m_name: string | null;
  l_name: string;
  phone_number_1: string;
  phone_number_2: string | null;
}

export interface ChildDetailsInput {
  pers: PersInfo | null;
  parents: ParentInput[];
  allergies: string[];
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
