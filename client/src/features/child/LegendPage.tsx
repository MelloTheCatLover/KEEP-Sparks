import { useEffect, useState } from "react";
import { settingsApi } from "../settings/settings-api";
import { settingLabel } from "../settings/labels";
import type { Legend, LegendItem, LegendShift } from "../settings/types";

// «За что искры» — легенда каталога глазами ребёнка. Цены версионированы по
// дате начала смены, поэтому страница всегда говорит про конкретную смену: «на
// твоей смене человек дня стоит 300», а не про абстрактный прайс.
//
// Правила отдельными карточками, а не одной таблицей: ребёнок ищет здесь не
// цену, а ответ «что мне сделать»; цена — довесок к правилу.

// Группы не по программе, а по тому, что нужно сделать: приехать, выиграть с
// командой, отличиться самому.
const GROUPS: { title: string; note?: string; keys: string[] }[] = [
  {
    title: "Просто за то, что ты здесь",
    keys: ["day"],
  },
  {
    title: "Всей командой",
    note: "Эти искры получает каждый в команде — не только капитан и не только тот, кто вышел на этап.",
    keys: [
      "ktb_stage",
      "ktb_winner",
      "kgg_cup",
      "kgg_winner",
      "wake_up_arena_winner",
    ],
  },
  {
    title: "Личное внутри команды",
    keys: ["ktb_team_best", "kgg_mvp"],
  },
  {
    title: "Реалити",
    keys: [
      "reality_winner",
      "reality_super_finalist",
      "reality_finalist",
      "reality_plot",
      "reality_leader",
    ],
  },
  {
    title: "Звёзды",
    keys: ["stars_winner", "stars_finalist"],
  },
  {
    title: "Личные награды",
    keys: ["person_of_shift", "person_of_day", "recognition"],
  },
];

// Что нужно сделать, чтобы это получить. Подпись важнее цены: без неё строка
// каталога ребёнку ничего не говорит.
const HINTS: Record<string, string> = {
  day: "Начисляются сами, за каждый день смены кроме дня отъезда. Делать ничего не нужно.",
  ktb_stage: "Команде, взявшей этап КТБ, — каждому её участнику.",
  ktb_winner: "Команде, набравшей больше всех баллов за все этапы.",
  kgg_cup: "Каждый кубок команды — искры каждому в ней.",
  kgg_winner: "Команде, собравшей больше всех кубков.",
  wake_up_arena_winner:
    "Комнате, выигравшей раунд Wake Up Арены, — каждому жителю.",
  ktb_team_best: "Тому, кто вытянул свою команду.",
  kgg_mvp: "Лучшему игроку по итогам всего КГГ.",
  reality_winner: "Победа в реалити — самая дорогая награда смены.",
  reality_super_finalist: "Дошёл до супер-финала.",
  reality_finalist: "Дошёл до финала.",
  reality_plot: "Сделал ход, который развернул сюжет.",
  reality_leader: "Лучший в игровом дне.",
  stars_winner: "Победа в «Звёздах».",
  stars_finalist: "Финал «Звёзд».",
  person_of_shift: "Один человек за всю смену.",
  person_of_day: "Один-два человека каждый день.",
  recognition: "Отдельное решение руководителя — за то, что не влезает в таблицу.",
};

const ru = (n: number): string => n.toLocaleString("ru-RU");

export function LegendPage() {
  const [data, setData] = useState<Legend | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    settingsApi
      .legend()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-[var(--color-danger)]">
        Не удалось загрузить легенду.
      </div>
    );
  }
  if (!data) {
    return <div className="text-[var(--color-text-muted)]">Загрузка…</div>;
  }

  const byKey = new Map(data.items.map((i) => [i.name, i]));
  const used = new Set(GROUPS.flatMap((g) => g.keys));
  const rest = data.items.filter((i) => !used.has(i.name));

  return (
    <div className="flex flex-col gap-3">
      <Hero shift={data.shift} />
      {GROUPS.map((g) => {
        const items = g.keys
          .map((k) => byKey.get(k))
          .filter((i): i is LegendItem => Boolean(i));
        if (!items.length) return null;
        return (
          <Group key={g.title} title={g.title} note={g.note} items={items} />
        );
      })}
      {rest.length > 0 && <Group title="Остальное" items={rest} />}
      <Cascade byKey={byKey} />
    </div>
  );
}

// Шапка: коэффициент смены. Он и есть главное, чего не видно в таблице цен —
// ребёнок сложит 300 и 30, а в профиле увидит другое число и решит, что его
// обсчитали.
function Hero({ shift }: { shift: LegendShift | null }) {
  const title = shift
    ? `Смена ${shift.shift_id}${shift.name ? ` «${shift.name}»` : ""}`
    : "Цены на сегодня";

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)]">
      <h1 className="text-lg font-semibold">За что дают искры</h1>
      <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
        {title}
        {shift && shift.state === "next" && " — цены будущей смены"}
        {shift && shift.state === "past" && " — цены прошедшей смены"}
      </p>

      {shift && (
        <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-bg)] px-3 py-2 text-[13px] leading-relaxed">
          На смене {shift.person_count} человек, поэтому итог умножается на{" "}
          <span className="font-semibold text-[var(--color-brand)]">
            ×{shift.difficulty.toFixed(2)}
          </span>
          . Чем больше народу — тем дороже смена: обойти всех труднее.
          <br />
          <span className="text-[var(--color-text-muted)]">
            Коэффициент применяется к сумме за всю смену и округляется один раз,
            поэтому в профиле число чуть отличается от сложенных цен ниже.
          </span>
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  note,
  items,
}: {
  title: string;
  note?: string;
  items: LegendItem[];
}) {
  return (
    <section className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold">{title}</h2>
      {note && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{note}</p>
      )}
      <ul className="mt-2 flex flex-col">
        {items.map((i) => (
          <li
            key={i.name}
            className="flex items-baseline justify-between gap-4 border-t border-[var(--color-border)] py-2 first:border-t-0"
          >
            <div>
              <div className="text-[13px] font-medium">
                {settingLabel(i.name)}
              </div>
              {HINTS[i.name] && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  {HINTS[i.name]}
                </div>
              )}
            </div>
            <div className="shrink-0 text-base font-semibold tabular-nums text-[var(--color-brand)]">
              {ru(i.value)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Победа в реалити тянет за собой финал и супер-финал — их отмечают тому же
// человеку. Сумма считается из цен смены, а не вписана числом: прайс меняется.
function Cascade({ byKey }: { byKey: Map<string, LegendItem> }) {
  const parts = [
    "reality_winner",
    "reality_super_finalist",
    "reality_finalist",
  ].map((k) => byKey.get(k));
  if (parts.some((p) => !p)) return null;
  const total = parts.reduce((sum, p) => sum + (p?.value ?? 0), 0);

  return (
    <p className="px-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
      Победитель реалити проходит и финал, и супер-финал, поэтому получает всё
      сразу:{" "}
      {parts.map((p, idx) => (
        <span key={p?.name}>
          {idx > 0 && " + "}
          {ru(p?.value ?? 0)}
        </span>
      ))}{" "}
      = <span className="font-semibold">{ru(total)}</span> искр, и это ещё до
      коэффициента смены.
    </p>
  );
}
