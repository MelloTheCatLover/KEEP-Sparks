import { useEffect, useState } from "react";
import { sparksApi } from "./sparks-api";
import type { SparksSummary } from "./types";

// Russian plural for "искра": 1 искра, 2 искры, 5 искр.
function sparksWord(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "искр";
  if (mod10 === 1) return "искра";
  if (mod10 >= 2 && mod10 <= 4) return "искры";
  return "искр";
}

export function SparksPanel() {
  const [summary, setSummary] = useState<SparksSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    sparksApi
      .me()
      .then((s) => {
        if (active) setSummary(s);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить искры.
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-[var(--color-text-muted)]">Загрузка искр…</div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card label="Твои искры">
        <span className="text-3xl font-bold text-[var(--color-brand)]">
          {summary.sparks.toLocaleString("ru-RU")}
        </span>{" "}
        <span className="text-sm text-[var(--color-text-muted)]">
          {sparksWord(summary.sparks)}
        </span>
      </Card>
      <Card label="Место в рейтинге">
        <span className="text-3xl font-bold">#{summary.rank}</span>{" "}
        <span className="text-sm text-[var(--color-text-muted)]">
          из {summary.total}
        </span>
      </Card>
    </div>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">{label}</p>
      <div>{children}</div>
    </div>
  );
}
