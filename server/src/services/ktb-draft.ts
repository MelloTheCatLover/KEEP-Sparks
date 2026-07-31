// Подготовка составов КТБ: админ задаёт команды, система разводит по ним весь
// ростер смены. Раздача идёт группами — сначала расходятся те, кто уже был
// лучшим в команде, потом бывшие победители КТБ, потом остальные бывалые, и
// последними новенькие. Внутри группы порядок — по искрам.
//
// Смысл порядка: сильные не должны сойтись в одной команде. Если сыпать всех
// подряд по искрам, «лучшие» и «победители» перемешаются с середняками и перекос
// уедет в первые команды.
//
// Раздача — жадная (`assign`), потом доводка обменами внутри группы (`refine`):
// размеры команд и расклад групп ровные по построению, суммы искр выравнивает
// доводка.
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

// Сколько улучшающих обменов пробуем максимум. Реальный расклад сходится за
// десятки: каждый обмен строго уменьшает разрыв между парой команд.
const MAX_SWAPS = 500;

// Раздача идёт группами: сначала расходятся «лучшие», потом «победители» и так
// далее. Внутри группы ребёнок уходит в команду, у которой (1) меньше всего
// человек из этой же группы, (2) при равенстве — меньше искр. Первое условие и
// разводит сильных: пока каждой команде не досталось по одному «лучшему»,
// второго не получает никто.
//
// Размеры держатся ровными жёстким потолком: base = ⌊n/T⌋, и ровно `rem = n%T`
// команд получают право на одного лишнего. Потолок общий на всю раздачу, а не
// на группу, — иначе остатки разных групп («лучших» 6 на 4 команды, «бывалых»
// 17 на 4) складываются в одних и тех же командах.
function assign(
  candidates: DraftCandidate[],
  teams: DraftTeamPlan[],
): DraftCandidate[][] {
  const rosters: DraftCandidate[][] = teams.map(() => []);
  const perTier = teams.map(() => new Map<DraftTier, number>());
  const base = Math.floor(candidates.length / teams.length);
  const rem = candidates.length % teams.length;
  let over = 0;

  for (const tier of DRAFT_TIERS) {
    for (const c of ordered(candidates.filter((x) => x.tier === tier))) {
      const pick = teams
        .map((t, i) => ({ t, i }))
        .filter(
          ({ i }) =>
            rosters[i].length < base || (rosters[i].length === base && over < rem),
        )
        .sort(
          (a, b) =>
            (perTier[a.i].get(tier) ?? 0) - (perTier[b.i].get(tier) ?? 0) ||
            a.t.sparks - b.t.sparks ||
            a.i - b.i,
        )[0].i;

      if (rosters[pick].length === base) over += 1;
      rosters[pick].push(c);
      teams[pick].sparks += c.sparks;
      perTier[pick].set(tier, (perTier[pick].get(tier) ?? 0) + 1);
    }
  }

  return rosters;
}

// Доводка обменами. Жадная раздача даёт ровные размеры и ровные группы, но по
// искрам промахивается: сильные внутри группы идут подряд, и компенсировать их
// уже нечем — у новеньких ноль. Меняем местами двух детей из ОДНОЙ группы (тогда
// ни размеры, ни расклад групп не меняются), если это сближает суммы их команд.
// На реальной смене это ужимает разрыв с десятков тысяч искр до сотен.
function refine(teams: DraftTeamPlan[], rosters: DraftCandidate[][]): void {
  for (let step = 0; step < MAX_SWAPS; step += 1) {
    let gain = 0;
    let best: { i: number; j: number; a: number; b: number; d: number } | null =
      null;

    for (let i = 0; i < teams.length; i += 1) {
      for (let j = 0; j < teams.length; j += 1) {
        if (i === j) continue;
        const diff = Math.abs(teams[i].sparks - teams[j].sparks);
        for (const [ai, a] of rosters[i].entries()) {
          for (const [bi, b] of rosters[j].entries()) {
            if (a.tier !== b.tier) continue;
            const d = a.sparks - b.sparks;
            if (d <= 0) continue;
            const after = Math.abs(teams[i].sparks - d - (teams[j].sparks + d));
            if (diff - after > gain) {
              gain = diff - after;
              best = { i, j, a: ai, b: bi, d };
            }
          }
        }
      }
    }

    if (!best) return;
    const { i, j, a, b, d } = best;
    [rosters[i][a], rosters[j][b]] = [rosters[j][b], rosters[i][a]];
    teams[i].sparks -= d;
    teams[j].sparks += d;
  }
}

export function distribute(
  candidates: DraftCandidate[],
  teamNames: string[],
): DraftTeamPlan[] {
  const teams: DraftTeamPlan[] = teamNames.map((name) => ({
    name,
    member_ids: [],
    sparks: 0,
  }));

  const rosters = assign(candidates, teams);
  refine(teams, rosters);

  // Состав фиксируем только после доводки: обмены переставляют детей, и
  // team_index, проставленный при раздаче, к этому моменту уже врал бы.
  for (const [i, roster] of rosters.entries()) {
    for (const c of roster) c.team_index = i;
    teams[i].member_ids = roster.map((c) => c.user_id);
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
