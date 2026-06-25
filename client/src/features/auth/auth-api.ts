import { api } from "../../shared/api/client";
import type { AuthResponse, LoginInput, RegisterInput, User } from "./types";

export const authApi = {
  register: (input: RegisterInput) =>
    api.post<AuthResponse>("/auth/register", input),
  login: (input: LoginInput) => api.post<AuthResponse>("/auth/login", input),
  me: () => api.get<User>("/auth/me"),
};
