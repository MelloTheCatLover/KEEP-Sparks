import { useEffect, useMemo, useState } from "react";
import { Button } from "../../shared/ui/Button";
import { ChildLink } from "../../shared/ui/ChildLink";
import { downloadSheet } from "../../shared/xlsx";
import { shiftsApi } from "./shifts-api";
import { KTB_LABEL, KTP_LABEL, ktbChip, ktpChip } from "./contest-status";
import type {
  ContestPerson,
  ContestsBoard,
  KtbStatus,
  KtpStatus,
} from "./types";

type Tab = "ktp" | "ktb";

// Status order within a tab, best first — also the filter chip order.
const KTP_ORDER: KtpStatus[] = ["mvp", "winner", "participant", "new"];
const KTB_ORDER: KtbStatus[] = ["team_best", "winner", "participant", "new"];

function fio(p: ContestPerson): string {
  return [p.l_name, p.f_name, p.m_name].filter(Boolean).join(" ");
}

// Board of every child who took part in КТП/КГГ or КТБ across the contest
// shifts. Two tabs, filterable by status; each exports to .xlsx.
export function ContestsPage() {
  const [board, setBoard] = useState<ContestsBoard | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("ktp");
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    shiftsApi
      .contests()
      .then((b) => active && setBoard(b))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  // Everyone who has any standing in the active contest ("new" = never took part
  // in it, so those are dropped from that tab).
  const rows = useMemo(() => {
    if (!board) return [];
    const keep =
      tab === "ktp"
        ? (p: ContestPerson) => p.ktp_status !== "new"
        : (p: ContestPerson) => p.ktb_status !== "new";
    return board.people
      .filter(keep)
      .filter((p) =>
        filter === null
          ? true
          : (tab === "ktp" ? p.ktp_status : p.ktb_status) === filter,
      );
  }, [board, tab, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    if (!board) return c;
    for (const p of board.people) {
      const s = tab === "ktp" ? p.ktp_status : p.ktb_status;
      if (s !== "new") c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [board, tab]);

  function exportTab() {
    const isKtp = tab === "ktp";
    const out = rows.map((p) => ({
      ФИО: fio(p),
      Статус: isKtp ? KTP_LABEL[p.ktp_status] : KTB_LABEL[p.ktb_status],
      Смены: (isKtp ? p.ktp_shifts : p.ktb_shifts).join(", "),
      Смен: (isKtp ? p.ktp_shifts : p.ktb_shifts).length,
    }));
    const name = isKtp ? "КТП-КГГ" : "КТБ";
    downloadSheet(`участники-${name}.xlsx`, name, out);
  }

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить участников.
      </div>
    );
  }
  if (!board) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const order = tab === "ktp" ? KTP_ORDER : KTB_ORDER;
  const label = tab === "ktp" ? KTP_LABEL : KTB_LABEL;
  const chip = tab === "ktp" ? ktpChip : ktbChip;
  const shiftIds = tab === "ktp" ? board.ktp_shift_ids : board.ktb_shift_ids;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">Участники КТП/КГГ и КТБ</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Статус — лучший за всю историю. Смены {tab === "ktp" ? "КТП/КГГ" : "КТБ"}:{" "}
          {shiftIds.join(", ")}.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["ktp", "ktb"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setFilter(null);
              }}
              className={
                "rounded-[var(--radius-sm)] px-3 py-1 text-[13px] " +
                (tab === t
                  ? "bg-[var(--color-brand)] text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)]")
              }
            >
              {t === "ktp" ? "КТП / КГГ" : "КТБ"}
            </button>
          ))}
        </div>
        <Button onClick={exportTab} className="px-2.5 py-1 text-xs">
          Скачать .xlsx
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === null}
          onClick={() => setFilter(null)}
          text={`Все (${order.reduce((s, k) => s + (counts[k] ?? 0), 0)})`}
        />
        {order.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(filter === s ? null : s)}
            text={`${label[s as keyof typeof label]} (${counts[s] ?? 0})`}
          />
        ))}
      </div>

      <div className="overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-4 py-1.5 font-medium">Ребёнок</th>
              <th className="px-4 py-1.5 font-medium">Статус</th>
              <th className="px-4 py-1.5 font-medium">Смены</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const st = tab === "ktp" ? p.ktp_status : p.ktb_status;
              const sh = tab === "ktp" ? p.ktp_shifts : p.ktb_shifts;
              return (
                <tr
                  key={p.user_id}
                  className="border-t border-[var(--color-border)]"
                >
                  <td className="px-4 py-1.5">
                    <ChildLink id={p.user_id}>{fio(p)}</ChildLink>
                  </td>
                  <td className="px-4 py-1.5">
                    <span
                      className={`inline-block border px-2 py-0.5 text-[11px] ${chip(
                        st as never,
                      )}`}
                    >
                      {label[st as keyof typeof label]}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-[var(--color-text-muted)]">
                    {sh.length ? sh.join(", ") : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-3 text-center text-[var(--color-text-muted)]"
                >
                  Нет участников.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  text,
}: {
  active: boolean;
  onClick: () => void;
  text: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-[var(--radius-sm)] border px-2.5 py-0.5 text-xs " +
        (active
          ? "border-[var(--color-brand)] text-[var(--color-brand)]"
          : "border-[var(--color-border)] text-[var(--color-text-muted)]")
      }
    >
      {text}
    </button>
  );
}
