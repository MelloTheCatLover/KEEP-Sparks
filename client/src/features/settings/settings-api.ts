import { api } from "../../shared/api/client";
import type { Setting } from "./types";

export const settingsApi = {
  list: () => api.get<Setting[]>("/settings"),
  updateValue: (id: number, value: number) =>
    api.patch<Setting>(`/settings/${id}`, { value }),
};
