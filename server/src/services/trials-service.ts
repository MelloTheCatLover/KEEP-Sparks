import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  MyTrial,
  MyTrialDay,
  MyTrials,
  Trial,
  TrialBoard,
  TrialBoardRow,
  TrialMember,
  TrialRowMatch,
  TrialScoreRow,
  TrialUploadResult,
} from "../types/trials";

// Испытания смены: внутренняя игра со своими баллами (134 смена, «Разбитый
// парк»). Испытание = день + название, баллы приходят от админа таблицей
// «номер ФИО баллы». С искрами не связаны: ни коэффициента, ни общего рейтинга.
//
// Места не хранятся — считаются при чтении: в испытании среди тех, у кого есть
// баллы, по смене — среди всего ростера (у кого баллов нет, у того 0).

const MAX_ROWS = 1000;

async function loadShift(shiftId: number): Promise<{
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  days: number;
}> {
  const { rows } = await pool.query<{
    shift_id: number;
    name: string | null;
    start_date: string;
    end_date: string;
    days: number;
  }>(
    `SELECT shift_id, name, start_date::text, end_date::text,
            (end_date - start_date + 1)::int AS days
     FROM shift_info WHERE shift_id = $1`,
    [shiftId],
  );
  if (rows.length === 0) throw new AppError(404, "Shift not found");
  return rows[0];
}

// Испытание своей смены: id приходит из адреса, и чужое так не тронуть.
async function loadTrial(shiftId: number, trialId: number): Promise<void> {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM trial WHERE id = $1 AND shift_id = $2",
    [trialId, shiftId],
  );
  if (!rowCount) throw new AppError(404, "Испытание не найдено");
}

export async function getBoard(shiftId: number): Promise<TrialBoard> {
  const shift = await loadShift(shiftId);

  const trials = await pool.query<Trial>(
    `SELECT t.id::int, t.day::int, t.title,
            (t.published_at IS NOT NULL) AS published,
            COUNT(s.user_id)::int AS scored
     FROM trial t
     LEFT JOIN trial_score s ON s.trial_id = t.id
     WHERE t.shift_id = $1
     GROUP BY t.id
     ORDER BY t.day, t.created_at, t.id`,
    [shiftId],
  );

  // Админ видит итог по всем испытаниям, в том числе неоткрытым: сверить
  // таблицу нужно до того, как её увидят дети.
  const members = await pool.query<TrialMember>(
    `WITH totals AS (
       SELECT m.user_id, m.number,
              COALESCE(SUM(s.points), 0) AS total,
              COALESCE(
                jsonb_object_agg(s.trial_id::text, s.points::float8)
                  FILTER (WHERE s.trial_id IS NOT NULL),
                '{}'::jsonb
              ) AS scores
       FROM shift_members m
       LEFT JOIN trial t ON t.shift_id = m.shift_id
       LEFT JOIN trial_score s ON s.trial_id = t.id AND s.user_id = m.user_id
       WHERE m.shift_id = $1
       GROUP BY m.user_id, m.number
     )
     SELECT RANK() OVER (ORDER BY x.total DESC)::int AS place,
            x.total::float8 AS total, x.scores, x.number,
            u.id AS user_id, u.f_name, u.m_name, u.l_name
     FROM totals x
     JOIN user_main u ON u.id = x.user_id
     ORDER BY place, x.number NULLS LAST, u.l_name, u.f_name`,
    [shiftId],
  );

  return { ...shift, trials: trials.rows, members: members.rows };
}

function checkDay(day: number, days: number): void {
  if (!Number.isInteger(day) || day < 1 || day > days) {
    throw new AppError(400, `День должен быть от 1 до ${days}`);
  }
}

function checkTitle(title: string): string {
  const t = title.trim();
  if (!t) throw new AppError(400, "Field 'title' must be a non-empty string");
  if (t.length > 200) throw new AppError(400, "Название слишком длинное");
  return t;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

const DUPLICATE_TRIAL = "Испытание с таким названием в этот день уже есть";

export async function createTrial(
  shiftId: number,
  day: number,
  title: string,
): Promise<TrialBoard> {
  const shift = await loadShift(shiftId);
  checkDay(day, shift.days);
  try {
    await pool.query(
      "INSERT INTO trial (shift_id, day, title) VALUES ($1, $2, $3)",
      [shiftId, day, checkTitle(title)],
    );
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, DUPLICATE_TRIAL);
    throw err;
  }
  return getBoard(shiftId);
}

// Переименовать, перенести на другой день, открыть или спрятать. Момент
// публикации не переписывается при повторном открытии.
export async function updateTrial(
  shiftId: number,
  trialId: number,
  fields: { day?: number; title?: string; published?: boolean },
): Promise<TrialBoard> {
  const shift = await loadShift(shiftId);
  await loadTrial(shiftId, trialId);
  if (fields.day !== undefined) checkDay(fields.day, shift.days);
  const title = fields.title === undefined ? null : checkTitle(fields.title);

  try {
    await pool.query(
      `UPDATE trial
       SET day = COALESCE($2, day),
           title = COALESCE($3, title),
           published_at = CASE
             WHEN $4::boolean IS NULL THEN published_at
             WHEN NOT $4::boolean THEN NULL
             ELSE COALESCE(published_at, NOW())
           END
       WHERE id = $1`,
      [trialId, fields.day ?? null, title, fields.published ?? null],
    );
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, DUPLICATE_TRIAL);
    throw err;
  }
  return getBoard(shiftId);
}

export async function deleteTrial(
  shiftId: number,
  trialId: number,
): Promise<TrialBoard> {
  await loadTrial(shiftId, trialId);
  await pool.query("DELETE FROM trial WHERE id = $1", [trialId]);
  return getBoard(shiftId);
}

// ФИО → набор слов для сравнения: регистр, «ё» и знаки препинания не важны,
// порядок слов тоже («Иван Петров» = «Петров Иван Сергеевич»).
function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

interface RosterEntry {
  user_id: string;
  number: number | null;
  f_name: string;
  m_name: string | null;
  l_name: string;
}

function fio(m: RosterEntry): string {
  return `${m.l_name} ${m.f_name} ${m.m_name ?? ""}`.trim();
}

// Фамилия и имя из ростера целиком есть среди слов строки. Отчество не
// требуется: в таблицах судей его пишут через раз.
function sameName(m: RosterEntry, rowWords: Set<string>): boolean {
  const need = [...words(m.l_name), ...words(m.f_name)];
  return need.length > 0 && need.every((w) => rowWords.has(w));
}

function checkRows(rows: TrialScoreRow[]): void {
  if (rows.length === 0) throw new AppError(400, "Таблица пустая");
  if (rows.length > MAX_ROWS) {
    throw new AppError(400, `Не больше ${MAX_ROWS} строк за раз`);
  }
  for (const r of rows) {
    if (r.number !== null && (!Number.isInteger(r.number) || r.number < 0)) {
      throw new AppError(400, `Номер «${r.number}» — не целое число`);
    }
    if (!Number.isFinite(r.points) || Math.abs(r.points) >= 1e8) {
      throw new AppError(400, `Баллы «${r.points}» — не число`);
    }
    if (r.name.length > 300) throw new AppError(400, "ФИО слишком длинное");
  }
}

// Загрузка баллов одного испытания. Ребёнок ищется по номеру смены, ФИО — для
// сверки; без номера — по ФИО, если в ростере такой один.
//
// `apply = false` — только показать, как поняты строки. С `apply = true`
// баллы испытания заменяются целиком: повторная загрузка исправленной таблицы
// не оставляет хвостов от прежней. Если хоть одна строка не сопоставилась,
// ничего не пишется — сохранять половину таблицы опаснее, чем не сохранить.
export async function uploadScores(
  shiftId: number,
  trialId: number,
  rows: TrialScoreRow[],
  apply: boolean,
): Promise<TrialUploadResult> {
  await loadShift(shiftId);
  await loadTrial(shiftId, trialId);
  checkRows(rows);

  const { rows: roster } = await pool.query<RosterEntry>(
    `SELECT u.id AS user_id, m.number, u.f_name, u.m_name, u.l_name
     FROM shift_members m
     JOIN user_main u ON u.id = m.user_id
     WHERE m.shift_id = $1`,
    [shiftId],
  );
  const byNumber = new Map<number, RosterEntry[]>();
  for (const m of roster) {
    if (m.number === null) continue;
    byNumber.set(m.number, [...(byNumber.get(m.number) ?? []), m]);
  }

  const seen = new Set<string>();
  const matches: TrialRowMatch[] = rows.map((r, i) => {
    const rowWords = new Set(words(r.name));
    const byName = roster.filter((m) => sameName(m, rowWords));
    const numbered = r.number === null ? [] : (byNumber.get(r.number) ?? []);

    let found: RosterEntry | null = null;
    let status: TrialRowMatch["status"];
    if (numbered.length === 1) {
      found = numbered[0];
      status = sameName(found, rowWords) ? "ok" : "mismatch";
    } else if (numbered.length > 1) {
      // Один номер у двоих — номер ничего не решает, выручает ФИО.
      const both = numbered.filter((m) => sameName(m, rowWords));
      found = both.length === 1 ? both[0] : null;
      status = found ? "ok" : "ambiguous";
    } else if (byName.length === 1) {
      found = byName[0];
      // Номер указан, но такого в смене нет — ребёнок нашёлся по ФИО.
      status = r.number === null ? "ok" : "mismatch";
    } else {
      status = byName.length > 1 ? "ambiguous" : "unknown";
    }

    if (found && seen.has(found.user_id)) status = "duplicate";
    if (found) seen.add(found.user_id);

    return {
      line: i + 1,
      number: r.number,
      name: r.name,
      points: r.points,
      status,
      user_id: found?.user_id ?? null,
      matched_name: found ? fio(found) : null,
      matched_number: found?.number ?? null,
    };
  });

  const blocked = matches.some(
    (m) => m.status !== "ok" && m.status !== "mismatch",
  );
  const applied = apply && !blocked;

  if (applied) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM trial_score WHERE trial_id = $1", [
        trialId,
      ]);
      await client.query(
        `INSERT INTO trial_score (trial_id, user_id, points)
         SELECT $1, u, p FROM unnest($2::uuid[], $3::numeric[]) AS t(u, p)`,
        [
          trialId,
          matches.map((m) => m.user_id),
          matches.map((m) => m.points),
        ],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  return { applied, rows: matches, board: await getBoard(shiftId) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Испытания глазами ребёнка: последняя его смена, где открыто хотя бы одно
// испытание. Только открытые — неоткрытых нет в ответе вовсе.
export async function getMyTrials(userId: string): Promise<MyTrials | null> {
  const { rows: shifts } = await pool.query<{
    shift_id: number;
    name: string | null;
  }>(
    `SELECT si.shift_id, si.name
     FROM shift_info si
     JOIN shift_members m ON m.shift_id = si.shift_id AND m.user_id = $1
     WHERE EXISTS (
       SELECT 1 FROM trial t
       WHERE t.shift_id = si.shift_id AND t.published_at IS NOT NULL
     )
     ORDER BY si.start_date DESC, si.shift_id DESC
     LIMIT 1`,
    [userId],
  );
  if (shifts.length === 0) return null;
  const shift = shifts[0];

  const { rows: trials } = await pool.query<MyTrial & { day: number }>(
    `WITH ranked AS (
       SELECT s.trial_id, s.user_id, s.points,
              RANK() OVER (PARTITION BY s.trial_id ORDER BY s.points DESC) AS place,
              COUNT(*) OVER (PARTITION BY s.trial_id) AS scored
       FROM trial_score s
       JOIN trial t ON t.id = s.trial_id
       WHERE t.shift_id = $1 AND t.published_at IS NOT NULL
     )
     SELECT t.id::int, t.day::int, t.title,
            r.points::float8 AS points,
            r.place::int AS place,
            COALESCE((
              SELECT COUNT(*) FROM trial_score x WHERE x.trial_id = t.id
            ), 0)::int AS scored
     FROM trial t
     LEFT JOIN ranked r ON r.trial_id = t.id AND r.user_id = $2
     WHERE t.shift_id = $1 AND t.published_at IS NOT NULL
     ORDER BY t.day, t.created_at, t.id`,
    [shift.shift_id, userId],
  );

  // Табло смены — весь ростер: кто не набрал ничего, стоит с нулём. Δ — баллы
  // последнего открытого дня: видно, кто рванул вперёд вчера.
  const { rows: standing } = await pool.query<
    TrialBoardRow & { f_name: string; l_name: string }
  >(
    `WITH pub AS (
       SELECT id, day FROM trial
       WHERE shift_id = $1 AND published_at IS NOT NULL
     ), totals AS (
       SELECT m.user_id, m.number,
              COALESCE(SUM(s.points), 0) AS total,
              COALESCE(SUM(s.points) FILTER (
                WHERE p.day = (SELECT MAX(day) FROM pub)
              ), 0) AS delta
       FROM shift_members m
       LEFT JOIN pub p ON TRUE
       LEFT JOIN trial_score s ON s.trial_id = p.id AND s.user_id = m.user_id
       WHERE m.shift_id = $1
       GROUP BY m.user_id, m.number
     )
     SELECT RANK() OVER (ORDER BY x.total DESC)::int AS place,
            x.number, x.total::float8 AS total, x.delta::float8 AS delta,
            u.f_name, u.l_name, (u.id = $2) AS is_me
     FROM totals x
     JOIN user_main u ON u.id = x.user_id
     ORDER BY place, x.number NULLS LAST, u.l_name, u.f_name`,
    [shift.shift_id, userId],
  );
  const mine = standing.find((r) => r.is_me);
  if (!mine) return null;
  const board: TrialBoardRow[] = standing.map((r) => ({
    place: r.place,
    number: r.number,
    name: `${r.f_name} ${r.l_name.charAt(0)}.`,
    total: r.total,
    delta: r.delta,
    is_me: r.is_me,
  }));

  const days: MyTrialDay[] = [];
  for (const { day, ...t } of trials) {
    let d = days[days.length - 1];
    if (!d || d.day !== day) {
      d = { day, total: 0, trials: [] };
      days.push(d);
    }
    d.trials.push(t);
    d.total = round2(d.total + (t.points ?? 0));
  }

  return {
    shift_id: shift.shift_id,
    name: shift.name,
    me: { f_name: mine.f_name, l_name: mine.l_name, number: mine.number },
    total: mine.total,
    place: mine.place,
    participants: standing.length,
    last_day: days.length ? days[days.length - 1].day : 0,
    board,
    days,
  };
}
