import { useEffect, useState } from "react";
import { sparksApi } from "../sparks/sparks-api";
import type { MyBreakdown } from "../sparks/types";
import { KtbTeamCard } from "../dashboard/KtbTeamCard";
import { LiveShiftCard } from "../dashboard/LiveShiftCard";

// «Моя смена»: всё про смену, которая идёт прямо сейчас — команда КТБ, искры по
// дням и за что они пришли. Отдельной страницей, а не блоком в профиле: в
// профиле копятся итоги за все годы, а смена — то, что происходит сегодня.
export function MyShiftPage() {
  const [data, setData] = useState<MyBreakdown | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    sparksApi
      .myBreakdown()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [reload]);

  // Искры за день отдаёт админ, момент заранее не известен — страница раз в
  // минуту перепроверяет, не появилось ли что открыть.
  const watching = Boolean(data?.live || data?.ktb);
  useEffect(() => {
    if (!watching) return;
    const id = setInterval(() => setReload((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [watching]);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить смену.
      </div>
    );
  }
  if (!data) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  if (!data.live && !data.ktb) {
    return (
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] shadow-[var(--shadow-card)]">
        Сейчас смены нет. Здесь появятся искры за дни и твоя команда КТБ.
      </div>
    );
  }

  const refresh = () => setReload((n) => n + 1);

  return (
    <div className="flex flex-col gap-3">
      {data.ktb && (
        <KtbTeamCard ktb={data.ktb} onReveal={refresh} onOpened={refresh} />
      )}
      {data.live && <LiveShiftCard live={data.live} onProgress={refresh} />}
    </div>
  );
}
