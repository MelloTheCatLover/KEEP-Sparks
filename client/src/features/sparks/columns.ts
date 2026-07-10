// Achievement columns in catalogue order.
//   short — compact table header (2–4 chars)
//   full  — readable name (tooltip / xlsx header)
//   group — programme it belongs to, used to build the legend
//   hint  — one plain-language sentence of what earns it
// Shared by the overall rating table, the names lookup export and the per-shift
// achievements editor.
export interface AchievementColumn {
  key: string;
  short: string;
  full: string;
  group: string;
  hint: string;
}

export const ACHIEVEMENT_COLUMNS: AchievementColumn[] = [
  {
    key: "reality_winner",
    short: "Поб",
    full: "Реалити-шоу: победа",
    group: "Реалити-шоу",
    hint: "Победитель реалити-шоу смены.",
  },
  {
    key: "reality_super_finalist",
    short: "Суф",
    full: "Реалити-шоу: суперфинал",
    group: "Реалити-шоу",
    hint: "Дошёл до суперфинала реалити-шоу.",
  },
  {
    key: "reality_finalist",
    short: "Фин",
    full: "Реалити-шоу: финал",
    group: "Реалити-шоу",
    hint: "Дошёл до финала реалити-шоу.",
  },
  {
    key: "reality_plot",
    short: "Сюж",
    full: "Реалити-шоу: лучший сюжет",
    group: "Реалити-шоу",
    hint: "Отмечен за лучший сюжет / линию в реалити-шоу.",
  },
  {
    key: "reality_leader",
    short: "Лид",
    full: "Реалити-шоу: лидер",
    group: "Реалити-шоу",
    hint: "Признан лидером / лучшим игроком реалити-шоу.",
  },
  {
    key: "stars_winner",
    short: "Зв·П",
    full: "Звёзды: победа",
    group: "Звёзды",
    hint: "Победитель конкурса «Звёзды».",
  },
  {
    key: "stars_finalist",
    short: "Зв·Ф",
    full: "Звёзды: финал",
    group: "Звёзды",
    hint: "Финалист конкурса «Звёзды».",
  },
  {
    key: "ktb_winner",
    short: "КТБ·П",
    full: "КТБ: победа",
    group: "КТБ",
    hint: "Победа в КТБ (командной творческой битве).",
  },
  {
    key: "ktb_stage",
    short: "КТБ·Э",
    full: "КТБ: этап",
    group: "КТБ",
    hint: "Пройден этап КТБ.",
  },
  {
    key: "ktb_team_best",
    short: "КТБ·Л",
    full: "КТБ: лучший в команде",
    group: "КТБ",
    hint: "Лучший игрок своей команды в КТБ.",
  },
  {
    key: "kgg_winner",
    short: "КГГ·П",
    full: "КГГ: победа",
    group: "КГГ",
    hint: "Победа в КГГ.",
  },
  {
    key: "kgg_mvp",
    short: "КГГ·M",
    full: "КГГ: лучший из лучших",
    group: "КГГ",
    hint: "Лучший из лучших (MVP) в КГГ.",
  },
  {
    key: "kgg_cup",
    short: "КГГ·К",
    full: "КГГ: кубок",
    group: "КГГ",
    hint: "Получил кубок КГГ.",
  },
  {
    key: "person_of_shift",
    short: "Ч.смены",
    full: "Человек смены",
    group: "Общие",
    hint: "Человек смены — главное признание за всю смену.",
  },
  {
    key: "person_of_day",
    short: "Ч.дня",
    full: "Человек дня",
    group: "Общие",
    hint: "Сколько раз был человеком дня.",
  },
  {
    key: "recognition",
    short: "Призн",
    full: "Признание руководителя",
    group: "Общие",
    hint: "Личное признание от руководителя.",
  },
  {
    key: "day",
    short: "Дни",
    full: "Дни присутствия",
    group: "Общие",
    hint: "Количество дней на смене.",
  },
];
