// Подготовка составов КТБ: админ задаёт команды, система разводит по ним весь
// ростер смены. Раздача идёт группами — сначала расходятся те, кто уже был
// лучшим в команде, потом бывшие победители КТБ, потом остальные бывалые, и
// последними новенькие. Внутри группы порядок — по искрам.
//
// Смысл порядка: сильные не должны сойтись в одной команде. Если сыпать всех
// подряд по искрам, «лучшие» и «победители» перемешаются с середняками и перекос
// уедет в первые команды.
//
// Черновик ничего не пишет в базу. Сохраняет его обычный `saveTeams` тем
// планом, который админ увидел, — повторный расчёт даёт другую раскладку
// (равные искры разрываются случайно).
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  DRAFT_TIERS,
  DraftCandidate,
  DraftTeamPlan,
  DraftTier,
  KtbDraftPlan,
} from "../types/live";
import { getBoard } from "./sparks-service";

const MAX_TEAMS = 32;

// Группа ребёнка по прошлым сменам. Порядок проверок = приоритет: у кого есть
// и `ktb_team_best`, и `ktb_winner`, тот идёт как «лучший».
function tierOf(row: {
  best: number;
  winner: number;
  past_shifts: number;
}): DraftTier {
  if (row.best > 0) return "best";
  if (row.winner > 0) return "winner";
  if (row.past_shifts > 0) return "member";
  return "rookie";
}

// Ростер смены с признаками прошлого опыта. «Прошлое» = смены, начавшиеся
// раньше текущей (номера смен идут не подряд, поэтому сравниваем даты, а не id);
// псевдо-смена «Архив» с ранней датой попадает сюда естественным образом.
async function loadCandidates(shiftId: number): Promise<
  { user_id: string; best: number; winner: number; past_shifts: number }[]
> {
  const { rows } = await pool.query<{
    user_id: string;
    best: number;
    winner: number;
    past_shifts: number;
  }>(
    `WITH cur AS (
       SELECT start_date FROM shift_info WHERE shift_id = $1
     ),
     past AS (
       SELECT pm.user_id, COUNT(DISTINCT pm.shift_id)::int AS shifts
       FROM shift_members pm
       JOIN shift_info psi ON psi.shift_id = pm.shift_id
       WHERE psi.start_date < (SELECT start_date FROM cur)
       GROUP BY pm.user_id
     ),
     hist AS (
       SELECT a.user_id, s.name, SUM(a.amount)::int AS amount
       FROM achievements a
       JOIN settings s ON s.id = a.setting_id
       JOIN shift_info si ON si.shift_id = a.shift_id
       WHERE si.start_date < (SELECT start_date FROM cur)
         AND s.name IN ('ktb_team_best', 'ktb_winner')
       GROUP BY a.user_id, s.name
     )
     SELECT m.user_id,
            COALESCE(MAX(CASE WHEN h.name = 'ktb_team_best' THEN h.amount END), 0)
              AS best,
            COALESCE(MAX(CASE WHEN h.name = 'ktb_winner' THEN h.amount END), 0)
              AS winner,
            COALESCE(p.shifts, 0) AS past_shifts
     FROM shift_members m
     LEFT JOIN past p ON p.user_id = m.user_id
     LEFT JOIN hist h ON h.user_id = m.user_id
     WHERE m.shift_id = $1
     GROUP BY m.user_id, p.shifts`,
    [shiftId],
  );
  return rows;
}

// Порядок внутри группы: искры ↓, при равных — случайно. Случайность нужна
// новеньким: у них у всех ноль искр, и без неё они каждый раз ложились бы в том
// же порядке, в каком их вернула база.
function ordered(group: DraftCandidate[]): DraftCandidate[] {
  return group
    .map((c) => ({ c, r: Math.random() }))
    .sort((a, b) => b.c.sparks - a.c.sparks || a.r - b.r)
    .map((x) => x.c);
}

// Раздача змейкой: 1→N, N→1, 1→N… Очередь одна на всю смену — группы идут
// подряд, змейка через границу группы не перезапускается. Из-за этого каждый
// полный проход раздаёт ровно по одному ребёнку в команду, и размеры не
// расходятся больше чем на одного; перезапуск на каждой группе давал разброс до
// числа групп.
//
// Чередование направления и делает суммы близкими: кто выбирал первым в одном
// проходе, выбирает последним в следующем.
export function distribute(
  candidates: DraftCandidate[],
  teamNames: string[],
): DraftTeamPlan[] {
  const teams: DraftTeamPlan[] = teamNames.map((name) => ({
    name,
    member_ids: [],
    sparks: 0,
  }));

  const queue = DRAFT_TIERS.flatMap((tier) =>
    ordered(candidates.filter((c) => c.tier === tier)),
  );

  let order: number[] = teams.map((_, i) => i);
  for (const [i, c] of queue.entries()) {
    const slot = i % teams.length;
    // На границе прохода порядок пересобирается: первым выбирает команда с
    // наименьшей суммой. Это и есть разворот змейки — только направление задаёт
    // не чётность прохода, а то, кто отстал. Простое чередование 1→N, N→1 здесь
    // работает хуже: очередь отсортирована по группам, а не по искрам сквозняком,
    // и на границе группы фиксированный порядок промахивается.
    if (slot === 0) {
      order = teams
        .map((t, idx) => ({ sparks: t.sparks, idx }))
        .sort((a, b) => a.sparks - b.sparks || a.idx - b.idx)
        .map((x) => x.idx);
    }
    const index = order[slot];
    teams[index].member_ids.push(c.user_id);
    teams[index].sparks += c.sparks;
    c.team_index = index;
  }

  return teams;
}

// Черновик раздачи для страницы «Ведение». Искры берём те же, что видит сам
// ребёнок (общий рейтинг), — иначе админ сравнивал бы состав с числами, которых
// нигде больше нет.
export async function planKtbTeams(
  shiftId: number,
  teamNames: string[],
): Promise<KtbDraftPlan> {
  const names = teamNames.map((n) => n.trim()).filter(Boolean);
  if (names.length < 2) {
    throw new AppError(400, "Нужно хотя бы две команды");
  }
  if (names.length > MAX_TEAMS) {
    throw new AppError(400, `Команд не может быть больше ${MAX_TEAMS}`);
  }
  if (new Set(names).size !== names.length) {
    throw new AppError(400, "Названия команд должны различаться");
  }

  const rows = await loadCandidates(shiftId);
  if (rows.length === 0) {
    throw new AppError(400, "В ростере смены никого нет");
  }
  if (names.length > rows.length) {
    throw new AppError(400, "Команд больше, чем детей на смене");
  }

  const sparks = new Map((await getBoard()).map((e) => [e.user_id, e.sparks]));
  const candidates: DraftCandidate[] = rows.map((r) => ({
    user_id: r.user_id,
    tier: tierOf(r),
    sparks: sparks.get(r.user_id) ?? 0,
    team_index: -1,
  }));

  const teams = distribute(candidates, names);

  // Отдаём ростер уже в порядке раздачи — админ видит план тем же взглядом,
  // каким он собирался.
  const tierRank = new Map(DRAFT_TIERS.map((t, i) => [t, i]));
  candidates.sort(
    (a, b) =>
      tierRank.get(a.tier)! - tierRank.get(b.tier)! || b.sparks - a.sparks,
  );

  return { teams, candidates };
}
