import { api } from "../../shared/api/client";
import type { PriceWindow, Setting } from "./types";

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
  priceWindow: () => api.get<PriceWindow>("/settings/price-window"),
  // Цена всегда объявляется с даты: правки задним числом нет — они переписали
  // бы уже выданные искры.
  setPrice: (id: number, valid_from: string, value: number) =>
    api.put<Setting>(`/settings/${id}/prices`, { valid_from, value }),
  deletePrice: (id: number, validFrom: string) =>
    api.delete<Setting>(`/settings/${id}/prices/${validFrom}`),
};
