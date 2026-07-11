import { api } from "../../shared/api/client";
import type {
  ChildAccount,
  ChildDetails,
  ChildDetailsInput,
  ChildInput,
  CreateChildInput,
  GeneratedCredential,
} from "./types";

export const childrenApi = {
  list: () => api.get<ChildAccount[]>("/children"),
  create: (input: CreateChildInput) =>
    api.post<ChildAccount>("/children", input),
  update: (id: string, input: ChildInput) =>
    api.patch<ChildAccount>(`/children/${id}`, input),
  getDetails: (id: string) => api.get<ChildDetails>(`/children/${id}/details`),
  saveDetails: (id: string, input: ChildDetailsInput) =>
    api.put<ChildDetails>(`/children/${id}/details`, input),
  setPassword: (id: string, password: string) =>
    api.post<void>(`/children/${id}/password`, { password }),
  // shiftId omitted -> all children. Returns plaintext to download.
  generatePasswords: (shiftId?: number) =>
    api.post<GeneratedCredential[]>("/children/generate-passwords", { shiftId }),
};
