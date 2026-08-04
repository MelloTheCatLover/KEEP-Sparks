import { api } from "../../shared/api/client";
import type { Setting } from "./types";

export interface AppState {
  maintenance: boolean;
  message: string;
}

export const settingsApi = {
  // Техобслуживание: флаг серверный, поэтому и читается, и пишется на сервере.
  state: () => api.get<AppState>("/state"),
  setMaintenance: (maintenance: boolean, message: string | null) =>
    api.put<AppState>("/state/maintenance", { maintenance, message }),
  list: () => api.get<Setting[]>("/settings"),
  updateValue: (id: number, value: number) =>
    api.patch<Setting>(`/settings/${id}`, { value }),
};
