import { api } from "../../shared/api/client";
import type { AuthResponse, LoginInput, User } from "./types";

export const authApi = {
  login: (input: LoginInput) => api.post<AuthResponse>("/auth/login", input),
  me: () => api.get<User>("/auth/me"),
};
