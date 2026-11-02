import { useEffect, useState } from "react";
import { sparksApi } from "./sparks-api";
import type { SeasonsInfo } from "./types";

// Какой рейтинг показан: общий, текущий (без 18+) или сезон — числом, годом
// начала сезона (2026 = «2026/27»).
export type RatingMode = "overall" | "current" | number;

export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

export function modeTitle(m: RatingMode): string {
  if (typeof m === "number") return `Сезон ${seasonLabel(m)}`;
  return m === "current" ? "Текущий рейтинг" : "Общий рейтинг";
}

// Сезоны грузятся один раз на страницу; без них переключатель просто не
// показывает сезонную вкладку.
export function useSeasons(): SeasonsInfo | null {
  const [info, setInfo] = useState<SeasonsInfo | null>(null);
  useEffect(() => {
    let active = true;
    sparksApi
      .seasons()
      .then((r) => active && setInfo(r))
      .catch(() => active && setInfo({ current: null, seasons: [] }));
    return () => {
      active = false;
    };
  }, []);
  return info;
}
