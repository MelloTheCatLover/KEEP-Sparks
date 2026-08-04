import { api } from "../../shared/api/client";
import type { Setting } from "./types";

export interface AppState {
  maintenance: boolean;
  message: string;
}

// Ребёнок с пропуском на техобслуживание.
export interface BypassUser {
  id: string;
  f_name: string;
  m_name: string | null;
  l_name: string;
  login: string;
}

export const settingsApi = {
  // Техобслуживание: флаг серверный, поэтому и читается, и пишется на сервере.
  state: () => api.get<AppState>("/state"),
  setMaintenance: (maintenance: boolean, message: string | null) =>
    api.put<AppState>("/state/maintenance", { maintenance, message }),
  bypass: () => api.get<BypassUser[]>("/state/bypass"),
  grantBypass: (query: string) =>
    api.post<BypassUser>("/state/bypass", { query }),
  revokeBypass: (id: string) => api.delete<void>(`/state/bypass/${id}`),
  list: () => api.get<Setting[]>("/settings"),
  updateValue: (id: number, value: number) =>
    api.patch<Setting>(`/settings/${id}`, { value }),
};
