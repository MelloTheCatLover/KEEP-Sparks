import { Link } from "react-router-dom";

// Admin hub: a panel of section buttons. New epics add cards here.
const SECTIONS: { to: string; title: string; desc: string }[] = [
  { to: "/admin/ranking", title: "Рейтинг детей", desc: "Кто сколько искр набрал" },
  { to: "/admin/overview", title: "Общий рейтинг", desc: "Все достижения строкой" },
  { to: "/admin/lookup", title: "Список по ФИО", desc: "Искры по списку → xlsx" },
  { to: "/admin/people-of-day", title: "Человеки дня", desc: "Кто сколько раз" },
  { to: "/admin/people-of-shift", title: "Человеки смен", desc: "Человек смены по сменам" },
  { to: "/admin/winners", title: "Победители и финалисты", desc: "Реалити-шоу по сменам" },
  { to: "/admin/shifts", title: "Смены", desc: "Страницы смен и рейтинг" },
  { to: "/admin/children", title: "Дети", desc: "Аккаунты и пароли" },
  { to: "/admin/settings", title: "Настройки начислений", desc: "Очки за достижения" },
];

const COMING: { title: string; desc: string }[] = [];

export function AdminHubPage() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SECTIONS.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-brand)] border border-transparent"
        >
          <p className="font-medium">{s.title}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{s.desc}</p>
        </Link>
      ))}
      {COMING.map((s) => (
        <div
          key={s.title}
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-4 opacity-60"
        >
          <p className="font-medium">{s.title}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{s.desc} · скоро</p>
        </div>
      ))}
    </div>
  );
}
