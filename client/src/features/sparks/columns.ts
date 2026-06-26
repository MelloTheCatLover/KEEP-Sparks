// Achievement columns in catalogue order. `short` is the compact table header,
// `full` the readable name (tooltip / xlsx header). Shared by the overall
// rating table and the names lookup export.
export const ACHIEVEMENT_COLUMNS: { key: string; short: string; full: string }[] =
  [
    { key: "reality_winner", short: "Поб", full: "Реалити: победа" },
    { key: "reality_super_finalist", short: "Суф", full: "Реалити: супер-финал" },
    { key: "reality_finalist", short: "Фин", full: "Реалити: финал" },
    { key: "reality_plot", short: "Сюж", full: "Реалити: сюжет" },
    { key: "reality_leader", short: "Лид", full: "Реалити: лучший / лидер" },
    { key: "stars_winner", short: "★Поб", full: "Звёзды: победа" },
    { key: "stars_finalist", short: "★Фин", full: "Звёзды: финал" },
    { key: "ktb_winner", short: "КТБп", full: "КТБ: победа" },
    { key: "ktb_stage", short: "КТБэ", full: "КТБ: этап" },
    { key: "ktb_team_best", short: "КТБл", full: "КТБ: лучший в команде" },
    { key: "kgg_winner", short: "КГГп", full: "КГГ: победа" },
    { key: "kgg_mvp", short: "КГГм", full: "КГГ: лучший из лучших" },
    { key: "kgg_cup", short: "Куб", full: "КГГ: кубок" },
    { key: "person_of_shift", short: "ЧСм", full: "Человек смены" },
    { key: "person_of_day", short: "ЧДн", full: "Человек дня" },
    { key: "recognition", short: "Прз", full: "Признание руководителя" },
    { key: "day", short: "Дни", full: "Дней присутствия" },
  ];
