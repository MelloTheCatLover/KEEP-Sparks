import { User } from "./user";

export interface RegisterInput {
  f_name: string;
  m_name?: string | null;
  l_name: string;
  login: string;
  password: string;
}

export interface LoginInput {
  login: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
