import { api } from "../../shared/api/client";
import type { ChildAccount, ChildInput, CreateChildInput } from "./types";

export const childrenApi = {
  list: () => api.get<ChildAccount[]>("/children"),
  create: (input: CreateChildInput) =>
    api.post<ChildAccount>("/children", input),
  update: (id: string, input: ChildInput) =>
    api.patch<ChildAccount>(`/children/${id}`, input),
  setPassword: (id: string, password: string) =>
    api.post<void>(`/children/${id}/password`, { password }),
};
