import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChildBreakdown } from "../sparks/types";
import { sparksApi } from "../sparks/sparks-api";
import { SparksDashboard } from "./SparksDashboard";

// Admin view of a child's personal page — the same read-only dashboard the
// child sees, reached by clicking their name anywhere in the admin area.
export function ChildDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ChildBreakdown | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setData(null);
    setError(false);
    sparksApi
      .childBreakdown(id)
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => navigate(-1)}
        className="self-start text-sm text-[var(--color-brand)]"
      >
        ← Назад
      </button>

      {error && (
        <div className="text-[var(--color-danger)]">
          Не удалось загрузить страницу ребёнка.
        </div>
      )}
      {!error && !data && (
        <div className="text-[var(--color-text-muted)]">Загрузка…</div>
      )}
      {data && (
        <>
          <h2 className="text-base font-semibold">
            {data.l_name} {data.f_name} {data.m_name ?? ""}
          </h2>
          <SparksDashboard data={data} />
        </>
      )}
    </div>
  );
}
