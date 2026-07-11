import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChildBreakdown } from "../sparks/types";
import { sparksApi } from "../sparks/sparks-api";
import { AdjustmentsPanel } from "../sparks/AdjustmentsPanel";
import { SparksDashboard } from "./SparksDashboard";

// Admin view of a child's personal page — the same read-only dashboard the
// child sees, reached by clicking their name anywhere in the admin area.
export function ChildDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Tag loaded data with its child id so switching children drops stale data
  // without a synchronous reset inside the effect.
  const [state, setState] = useState<{ id: string; data: ChildBreakdown } | null>(
    null,
  );
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    sparksApi
      .childBreakdown(id)
      .then((d) => {
        setState({ id, data: d });
        setError(false);
      })
      .catch(() => setError(true));
  }, [id]);

  useEffect(reload, [reload]);

  const data = state && state.id === id ? state.data : null;

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
          {id && <AdjustmentsPanel childId={id} onChange={reload} />}
        </>
      )}
    </div>
  );
}
