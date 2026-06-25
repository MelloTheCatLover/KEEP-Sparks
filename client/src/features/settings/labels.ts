// Human-readable Russian labels for the catalogue keys. Unknown keys fall back
// to the raw name.
const LABELS: Record<string, string> = {
  reality_winner: "Реалити: победа",
  reality_super_finalist: "Реалити: супер-финал",
  reality_finalist: "Реалити: финал",
  reality_plot: "Реалити: продвинул сюжет",
  reality_leader: "Реалити: лучший / лидер",
  stars_winner: "Звёзды: победа",
  stars_finalist: "Звёзды: финал",
  ktb_winner: "КТБ: победа",
  ktb_stage: "КТБ: этап",
  ktb_team_best: "КТБ: лучший в команде",
  kgg_winner: "КГГ/КТП: победа",
  kgg_mvp: "КГГ/КТП: лучший из лучших",
  kgg_cup: "КГГ/КТП: кубок",
  person_of_shift: "Человек смены",
  person_of_day: "Человек дня",
  recognition: "Признание руководителя",
  day: "День присутствия",
};

export function settingLabel(name: string): string {
  return LABELS[name] ?? name;
}
