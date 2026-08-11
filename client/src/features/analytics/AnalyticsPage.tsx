import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analyticsApi } from "./analytics-api";
import { ACHIEVEMENT_COLUMNS } from "../sparks/columns";
import type { AwardCategory, RewardAnalytics, ShiftStat } from "./types";

// Подписи и цвета групп. Порядок — от «дали всей команде» к «дали за приезд»:
// страница читается сверху вниз как ответ на вопрос «чем набирают искры».
const CATEGORY_META: Record<
  AwardCategory,
  { label: string; hint: string; color: string }
> = {
  team_shared: {
    label: "Командные",
    hint: "Этапы и победы КТБ/КГГ — начисляются каждому в команде.",
    color: "var(--color-brand)",
  },
  team_personal: {
    label: "Личное в команде",
    hint: "Лучший в команде КТБ, MVP КГГ — личное отличие внутри команды.",
    color: "var(--color-info)",
  },
  reality: {
    label: "Реалити-шоу",
    hint: "Победа, суперфинал, финал, сюжет, лидерство.",
    color: "var(--color-warning)",
  },
  stars: {
    label: "Звёзды",
    hint: "Конкурс «Звёзды» — бывает не на каждой смене.",
    color: "var(--color-danger)",
  },
  personal: {
    label: "Личное признание",
    hint: "Человек смены, человек дня, признание руководителя.",
    color: "var(--color-success)",
  },
  base: {
    label: "Дни присутствия",
    hint: "30 искр за день — получают все, кто приехал.",
    color: "var(--color-text-muted)",
  },
};

const AWARD_LABEL = new Map(
  ACHIEVEMENT_COLUMNS.map((c) => [c.key, c.full] as const),
);

const ru = (v: number) => v.toLocaleString("ru-RU");

export function AnalyticsPage() {
  const [data, setData] = useState<RewardAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    analyticsApi
      .rewards()
      .then((r) => active && setData(r))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить аналитику.
      </div>
    );
  }
  if (!data) {
    return <div className="text-[var(--color-text-muted)]">Считаю…</div>;
  }

  const rookie = data.cohorts.find((c) => c.cohort === "rookie")!;
  const veteran = data.cohorts.find((c) => c.cohort === "veteran")!;
  const team = data.categories.find((c) => c.category === "team_shared");
  const d = data.distribution;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">Аналитика наград</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          {data.shifts_counted} смен · {ru(data.child_shifts)} пар «ребёнок ×
          смена» · {ru(data.total_xp)} баллов до коэффициента. Считается по
          сменам в рейтинге; «Архив» и день рождения лагеря не в счёте — там
          агрегат за годы и ручные награды.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Искр с командных наград"
          value={`${team?.pct ?? 0}%`}
          hint="каждому в команде, вне зависимости от личного вклада"
        />
        <Tile
          label="Новичок в топ-25% смены"
          value={`${rookie.pct_top25}%`}
          hint={`у опытных — ${veteran.pct_top25}%`}
        />
        <Tile
          label="Топ-10% детей держат"
          value={`${d.top10_share}%`}
          hint={`всех искр рейтинга, Джини ${d.gini}`}
        />
        <Tile
          label="Медиана рейтинга"
          value={ru(d.median)}
          hint={`p90 — ${ru(d.p90)}, максимум — ${ru(d.max)}`}
        />
      </div>

      <Card
        title="Откуда берутся искры"
        note="Доли от всех баллов достижений за 19 смен, до коэффициента сложности."
      >
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {data.categories.map((c) => (
              <div
                key={c.category}
                style={{
                  width: `${c.pct}%`,
                  background: CATEGORY_META[c.category].color,
                }}
                title={`${CATEGORY_META[c.category].label} — ${c.pct}%`}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {data.categories.map((c) => (
              <div key={c.category} className="flex items-baseline gap-2 text-[13px]">
                <span
                  className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: CATEGORY_META[c.category].color }}
                />
                <span className="w-36 shrink-0 font-medium">
                  {CATEGORY_META[c.category].label}
                </span>
                <span className="w-14 shrink-0 text-right font-semibold text-[var(--color-brand)]">
                  {c.pct}%
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {CATEGORY_META[c.category].hint}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card
        title="Каталог наград: цена и доступность"
        note="«Доля ростера» и «средний чек» усреднены по сменам, где награда вообще выдавалась."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)]">
                <th className="px-4 py-1.5">Награда</th>
                <th className="px-2 py-1.5">Группа</th>
                <th className="px-2 py-1.5 text-right">Цена</th>
                <th className="px-2 py-1.5 text-right">Выдано</th>
                <th className="px-2 py-1.5 text-right">Всего баллов</th>
                <th className="px-2 py-1.5 text-right">Доля всех искр</th>
                <th className="px-2 py-1.5 text-right">% ростера получает</th>
                <th className="px-4 py-1.5 text-right">Средний чек</th>
              </tr>
            </thead>
            <tbody>
              {data.awards.map((a) => (
                <tr key={a.key} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-1">{AWARD_LABEL.get(a.key) ?? a.key}</td>
                  <td className="px-2 py-1">
                    <span
                      className="rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px]"
                      style={{
                        background: CATEGORY_META[a.category].color,
                        color: "#141416",
                      }}
                    >
                      {CATEGORY_META[a.category].label}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{ru(a.value)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{ru(a.units)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{ru(a.xp)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{a.pct}%</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {a.avg_pct_roster}%
                  </td>
                  <td className="px-4 py-1 text-right font-semibold tabular-nums text-[var(--color-brand)]">
                    {ru(a.avg_xp_per_recipient)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Новенький против опытного"
        note="Сравнение по месту внутри смены: смены разного размера, абсолютные баллы между ними несопоставимы."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)]">
                <th className="px-4 py-1.5">Показатель</th>
                <th className="px-2 py-1.5 text-right">Новенькие</th>
                <th className="px-2 py-1.5 text-right">Уже приезжали</th>
                <th className="px-4 py-1.5">Что значит</th>
              </tr>
            </thead>
            <tbody>
              <CohortRow
                label="Пар «ребёнок × смена»"
                a={ru(rookie.child_shifts)}
                b={ru(veteran.child_shifts)}
                hint="объём выборки"
              />
              <CohortRow
                label="Среднее место в смене"
                a={rookie.avg_percentile.toFixed(2)}
                b={veteran.avg_percentile.toFixed(2)}
                hint="доля ростера, которую обошёл: 1 — первый, 0.5 — ровно середина"
              />
              <CohortRow
                label="Попал в топ-3 смены"
                a={`${rookie.pct_top3}%`}
                b={`${veteran.pct_top3}%`}
                hint="шанс оказаться на виду"
              />
              <CohortRow
                label="Попал в топ-25% смены"
                a={`${rookie.pct_top25}%`}
                b={`${veteran.pct_top25}%`}
                hint="шанс на заметный результат"
              />
              <CohortRow
                label="Медиана баллов за смену"
                a={ru(rookie.median_xp)}
                b={ru(veteran.median_xp)}
                hint="типичный результат — по дну разрыва почти нет"
              />
              <CohortRow
                label="p90 баллов за смену"
                a={ru(rookie.p90_xp)}
                b={ru(veteran.p90_xp)}
                hint="потолок: расходятся именно верхушки"
              />
              <CohortRow
                label="Ничего, кроме дней присутствия"
                a={`${rookie.pct_zero_earned}%`}
                b={`${veteran.pct_zero_earned}%`}
                hint="уехал без единой награды"
              />
              <CohortRow
                label="Что-то принесли командные"
                a={`${rookie.pct_any_team}%`}
                b={`${veteran.pct_any_team}%`}
                hint="командные — главный вход в игру для новенького"
              />
              <CohortRow
                label="Средние баллы с командных"
                a={ru(rookie.avg_team_xp)}
                b={ru(veteran.avg_team_xp)}
                hint="за счёт команды новичок догоняет"
              />
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Насколько подъёмна следующая ступенька"
        note="Общий рейтинг: сколько искр стоит одно место в каждой полосе и что даёт ещё одна смена."
      >
        <div className="grid gap-3 px-4 py-3 md:grid-cols-2">
          <div>
            <h4 className="mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
              Цена одного места
            </h4>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)]">
                  <th className="py-1">Места</th>
                  <th className="py-1 text-right">Детей</th>
                  <th className="py-1 text-right">Средние искры</th>
                  <th className="py-1 text-right">Разрыв с соседом</th>
                </tr>
              </thead>
              <tbody>
                {d.bands.map((b) => (
                  <tr key={b.band} className="border-t border-[var(--color-border)]">
                    <td className="py-1">{b.band}</td>
                    <td className="py-1 text-right tabular-nums">{b.kids}</td>
                    <td className="py-1 text-right tabular-nums">
                      {ru(b.avg_sparks)}
                    </td>
                    <td className="py-1 text-right font-semibold tabular-nums text-[var(--color-brand)]">
                      {ru(b.median_gap)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
              Сколько смен — такой итог
            </h4>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)]">
                  <th className="py-1">Смен</th>
                  <th className="py-1 text-right">Детей</th>
                  <th className="py-1 text-right">Медиана искр</th>
                  <th className="py-1 text-right">В топ-25%</th>
                </tr>
              </thead>
              <tbody>
                {d.ladder.map((s) => (
                  <tr key={s.shifts} className="border-t border-[var(--color-border)]">
                    <td className="py-1">{s.shifts}</td>
                    <td className="py-1 text-right tabular-nums">{s.kids}</td>
                    <td className="py-1 text-right tabular-nums">
                      {ru(s.median_sparks)}
                    </td>
                    <td className="py-1 text-right font-semibold tabular-nums text-[var(--color-brand)]">
                      {s.pct_in_top25}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card
        title="Смены"
        note="Джини: 0 — баллы разошлись поровну, 1 — всё забрал один. Медианы — баллы за смену до коэффициента."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)]">
                <th className="px-4 py-1.5">Смена</th>
                <th className="px-2 py-1.5 text-right">Ростер</th>
                <th className="px-2 py-1.5 text-right">Коэф.</th>
                <th className="px-2 py-1.5 text-right">Новичков</th>
                <th className="px-2 py-1.5 text-right">Их доля искр</th>
                <th className="px-2 py-1.5 text-right">Медиана нов.</th>
                <th className="px-2 py-1.5 text-right">Медиана опытн.</th>
                <th className="px-2 py-1.5 text-right">Максимум</th>
                <th className="px-2 py-1.5 text-right">Командных</th>
                <th className="px-4 py-1.5 text-right">Джини</th>
              </tr>
            </thead>
            <tbody>
              {data.shifts.map((s) => (
                <ShiftRow key={s.shift_id} s={s} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-card)]">
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-[var(--color-brand)]">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
        {hint}
      </div>
    </div>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && (
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {note}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function CohortRow({
  label,
  a,
  b,
  hint,
}: {
  label: string;
  a: string;
  b: string;
  hint: string;
}) {
  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-4 py-1">{label}</td>
      <td className="px-2 py-1 text-right font-semibold tabular-nums text-[var(--color-brand)]">
        {a}
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{b}</td>
      <td className="px-4 py-1 text-[var(--color-text-muted)]">{hint}</td>
    </tr>
  );
}

function ShiftRow({ s }: { s: ShiftStat }) {
  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-4 py-1">
        <Link
          to={`/admin/shifts/${s.shift_id}`}
          className="text-[var(--color-brand)]"
        >
          {s.shift_id}
        </Link>{" "}
        <span className="text-[var(--color-text-muted)]">{s.name}</span>
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{s.roster}</td>
      <td className="px-2 py-1 text-right tabular-nums">{s.difficulty}</td>
      <td className="px-2 py-1 text-right tabular-nums">
        {s.rookies} <span className="text-[var(--color-text-muted)]">
          ({s.rookie_pct_roster}%)
        </span>
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{s.rookie_pct_xp}%</td>
      <td className="px-2 py-1 text-right tabular-nums">{ru(s.median_rookie)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{ru(s.median_veteran)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{ru(s.max_xp)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{s.team_pct_xp}%</td>
      <td className="px-4 py-1 text-right font-semibold tabular-nums text-[var(--color-brand)]">
        {s.gini}
      </td>
    </tr>
  );
}
