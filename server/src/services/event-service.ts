import { randomInt } from "node:crypto";
import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  EventAward,
  EventAwardInput,
  EventBoard,
  EventBoardEntry,
  EventMember,
  MyEvent,
} from "../types/event";

// Смена-событие (день рождения лагеря). Отличие от обычной смены: искры не
// считаются из достижений и коэффициента, а вводятся руками — название и
// число. Поэтому здесь нет ни пересчёта, ни settings: `event_award` и есть
// первоисточник.
//
// Награда становится видимой ребёнку и попадает в рейтинг только с
// `published_at` — до объявления со сцены её нет ни в одном ответе API.

async function loadEventShift(shiftId: number): Promise<{
  shift_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  event_mode: boolean;
  festive_until: string | null;
}> {
  const { rows } = await pool.query<{
    shift_id: number;
    name: string | null;
    start_date: string;
    end_date: string;
    event_mode: boolean;
    festive_until: string | null;
  }>(
    `SELECT shift_id, name, start_date::text, end_date::text, event_mode,
            festive_until::text
     FROM shift_info WHERE shift_id = $1`,
    [shiftId],
  );
  if (rows.length === 0) throw new AppError(404, "Shift not found");
  return rows[0];
}

async function isLive(shiftId: number): Promise<boolean> {
  const { rows } = await pool.query<{ live_mode: boolean }>(
    "SELECT live_mode FROM shift_info WHERE shift_id = $1",
    [shiftId],
  );
  return rows[0]?.live_mode === true;
}

export async function getBoard(shiftId: number): Promise<EventBoard> {
  const shift = await loadEventShift(shiftId);

  const members = await pool.query<EventMember>(
    `SELECT u.id AS user_id, u.f_name, u.m_name, u.l_name, u.login,
            COALESCE(SUM(a.amount) FILTER (WHERE a.published_at IS NOT NULL), 0)::int
              AS awarded,
            COALESCE(SUM(a.amount) FILTER (WHERE a.published_at IS NULL), 0)::int
              AS pending,
            p.amount AS prize,
            (p.opened_at IS NOT NULL) AS prize_opened
     FROM shift_members m
     JOIN user_main u ON u.id = m.user_id
     LEFT JOIN event_award a ON a.shift_id = m.shift_id AND a.user_id = m.user_id
     LEFT JOIN event_prize p ON p.shift_id = m.shift_id AND p.user_id = m.user_id
     WHERE m.shift_id = $1
     GROUP BY u.id, u.f_name, u.m_name, u.l_name, u.login, p.amount, p.opened_at
     ORDER BY u.l_name, u.f_name`,
    [shiftId],
  );

  const awards = await pool.query<EventAward>(
    `SELECT id::int, user_id, title, amount,
            (published_at IS NOT NULL) AS published,
            (opened_at IS NOT NULL) AS opened,
            in_rating,
            created_at
     FROM event_award
     WHERE shift_id = $1
     ORDER BY created_at DESC, id DESC`,
    [shiftId],
  );

  return {
    ...shift,
    members: members.rows,
    awards: awards.rows,
    prize_count: members.rows.filter((m) => m.prize !== null).length,
    prize_opened_count: members.rows.filter((m) => m.prize_opened).length,
  };
}

// Розыгрыш: каждому участнику, у кого сундука ещё нет, случайное число искр.
// Границы приходят от админа (по умолчанию 50–350).
//
// Повторное нажатие достаётся только новичкам ростера — уже разыгранные числа
// не переписываются, иначе ребёнок, открывший сундук, увидел бы в кабинете
// другое число.
export async function drawPrizes(
  shiftId: number,
  min: number,
  max: number,
): Promise<EventBoard> {
  const shift = await loadEventShift(shiftId);
  if (!shift.event_mode) {
    throw new AppError(400, "Смена не в режиме события");
  }
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
    throw new AppError(400, "Границы розыгрыша заданы неверно");
  }

  const { rows: pending } = await pool.query<{ user_id: string }>(
    `SELECT m.user_id
     FROM shift_members m
     LEFT JOIN event_prize p ON p.shift_id = m.shift_id AND p.user_id = m.user_id
     WHERE m.shift_id = $1 AND p.user_id IS NULL`,
    [shiftId],
  );

  if (pending.length > 0) {
    // randomInt, а не Math.random: числа раздаёт сервер, и предсказуемый
    // генератор здесь ни к чему.
    const amounts = pending.map(() => randomInt(min, max + 1));
    await pool.query(
      `INSERT INTO event_prize (shift_id, user_id, amount)
       SELECT $1, u, a FROM unnest($2::uuid[], $3::int[]) AS t(u, a)
       ON CONFLICT DO NOTHING`,
      [shiftId, pending.map((p) => p.user_id), amounts],
    );
  }

  return getBoard(shiftId);
}

// Перебросить числа тем, кто ещё не открыл сундук. Открытые не трогаются:
// показанное число уже засчитано.
export async function redrawPrizes(
  shiftId: number,
  min: number,
  max: number,
): Promise<EventBoard> {
  await loadEventShift(shiftId);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
    throw new AppError(400, "Границы розыгрыша заданы неверно");
  }

  const { rows } = await pool.query<{ user_id: string }>(
    "SELECT user_id FROM event_prize WHERE shift_id = $1 AND opened_at IS NULL",
    [shiftId],
  );
  for (const r of rows) {
    await pool.query(
      `UPDATE event_prize SET amount = $3, drawn_at = NOW()
       WHERE shift_id = $1 AND user_id = $2 AND opened_at IS NULL`,
      [shiftId, r.user_id, randomInt(min, max + 1)],
    );
  }
  return getBoard(shiftId);
}

// Отменить розыгрыш целиком — пока сундуки не открывали.
export async function clearPrizes(shiftId: number): Promise<EventBoard> {
  await loadEventShift(shiftId);
  await pool.query(
    "DELETE FROM event_prize WHERE shift_id = $1 AND opened_at IS NULL",
    [shiftId],
  );
  return getBoard(shiftId);
}

// Включить/выключить режим события у смены. Отдельный флаг, а не `live_mode`:
// у события нет дней, традиций и человека дня, и пересчёт достижений его
// трогать не должен.
export async function setEventMode(
  shiftId: number,
  eventMode: boolean,
): Promise<EventBoard> {
  const shift = await loadEventShift(shiftId);
  // Ведущаяся смена событием быть не может. Иначе её ростер и розыгрыш живут
  // на странице праздника: приезжие попадают в ростер смены, раздувают
  // коэффициент сложности, а сундуки уезжают не на ту смену — ребёнок видит
  // праздник только одной, самой свежей смены-события.
  if (eventMode && (await isLive(shiftId))) {
    throw new AppError(
      400,
      `Смена ${shift.shift_id} ведётся (режим «Ведение»). ` +
        "Событие — отдельная смена: выключите ведение или заведите новую.",
    );
  }
  await pool.query("UPDATE shift_info SET event_mode = $2 WHERE shift_id = $1", [
    shiftId,
    eventMode,
  ]);
  return getBoard(shiftId);
}

// До какого числа держать праздничное оформление сайта. Дата «настенная»,
// лагерная: сравнение идёт с сегодняшним днём в таймзоне лагеря.
export async function setFestiveUntil(
  shiftId: number,
  until: string | null,
): Promise<EventBoard> {
  if (until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    throw new AppError(400, `Bad festive_until '${until}'`);
  }
  await loadEventShift(shiftId);
  await pool.query(
    "UPDATE shift_info SET festive_until = $2::date WHERE shift_id = $1",
    [shiftId, until],
  );
  return getBoard(shiftId);
}

// Выдать одну награду списку детей. Каждому — своя строка: снимать и удалять
// их потом можно поимённо.
export async function addAwards(
  shiftId: number,
  input: EventAwardInput,
): Promise<EventBoard> {
  const shift = await loadEventShift(shiftId);
  if (!shift.event_mode) {
    throw new AppError(400, "Смена не в режиме события");
  }

  const title = input.title.trim();
  if (!title) throw new AppError(400, "Field 'title' must be a non-empty string");
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new AppError(400, "Field 'amount' must be a non-zero integer");
  }
  if (input.user_ids.length === 0) {
    throw new AppError(400, "Field 'user_ids' must be a non-empty list");
  }

  // Награда только участнику праздника: чужой id из тела запроса не пройдёт.
  const { rows: roster } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM shift_members
     WHERE shift_id = $1 AND user_id = ANY($2::uuid[])`,
    [shiftId, input.user_ids],
  );
  if (roster.length !== input.user_ids.length) {
    throw new AppError(400, "Некоторых детей нет в списке участников");
  }

  await pool.query(
    `INSERT INTO event_award
       (shift_id, user_id, title, amount, published_at, in_rating)
     SELECT $1, u, $3, $4,
            CASE WHEN $5::boolean THEN NOW() ELSE NULL END, $6::boolean
     FROM unnest($2::uuid[]) AS t(u)`,
    [
      shiftId,
      input.user_ids,
      title,
      input.amount,
      input.published,
      input.in_rating,
    ],
  );

  return getBoard(shiftId);
}

// Объявить награду (или спрятать обратно, если объявили рано). Момент
// публикации не переписывается на повторном включении.
export async function setAwardPublished(
  awardId: number,
  published: boolean,
): Promise<EventBoard> {
  const { rows } = await pool.query<{ shift_id: number }>(
    `UPDATE event_award
     SET published_at = CASE
           WHEN NOT $2::boolean THEN NULL
           ELSE COALESCE(published_at, NOW())
         END
     WHERE id = $1
     RETURNING shift_id`,
    [awardId, published],
  );
  if (rows.length === 0) throw new AppError(404, "Награда не найдена");
  return getBoard(rows[0].shift_id);
}

// Объявить разом всё, что ждёт. На празднике наград десятки — щёлкать каждую
// нечем.
export async function publishAll(shiftId: number): Promise<EventBoard> {
  await loadEventShift(shiftId);
  await pool.query(
    `UPDATE event_award SET published_at = NOW()
     WHERE shift_id = $1 AND published_at IS NULL`,
    [shiftId],
  );
  return getBoard(shiftId);
}

export async function deleteAward(awardId: number): Promise<EventBoard> {
  const { rows } = await pool.query<{ shift_id: number }>(
    "DELETE FROM event_award WHERE id = $1 RETURNING shift_id",
    [awardId],
  );
  if (rows.length === 0) throw new AppError(404, "Награда не найдена");
  return getBoard(rows[0].shift_id);
}

// Перенести ростер другой смены целиком: дети, которые и так отдыхают в лагере,
// участвуют в празднике все. Приезжие добавляются обычной вставкой списка ФИО.
export async function copyRoster(
  shiftId: number,
  fromShiftId: number,
): Promise<EventBoard> {
  const shift = await loadEventShift(shiftId);
  // Ростер наливается только в смену-событие. Кнопка живёт на странице
  // праздника, и открыть её можно у любой смены — а дописать чужих детей в
  // ростер идущей смены значит сдвинуть её коэффициент сложности.
  if (!shift.event_mode) {
    throw new AppError(400, "Смена не в режиме события");
  }
  const { rowCount } = await pool.query(
    "SELECT 1 FROM shift_info WHERE shift_id = $1",
    [fromShiftId],
  );
  if (!rowCount) throw new AppError(404, `Смены ${fromShiftId} нет`);

  await pool.query(
    `INSERT INTO shift_members (shift_id, user_id)
     SELECT $1, user_id FROM shift_members WHERE shift_id = $2
     ON CONFLICT DO NOTHING`,
    [shiftId, fromShiftId],
  );
  return getBoard(shiftId);
}

// Праздник глазами ребёнка: только объявленные награды. `revealAll` — для
// админа, который смотрит карточку ребёнка и должен видеть в том числе ждущие.
export async function getMyEvent(
  userId: string,
  revealAll = false,
): Promise<MyEvent | null> {
  const { rows: shifts } = await pool.query<{
    shift_id: number;
    name: string | null;
    start_date: string;
    end_date: string;
  }>(
    `SELECT si.shift_id, si.name, si.start_date::text, si.end_date::text
     FROM shift_info si
     JOIN shift_members m ON m.shift_id = si.shift_id AND m.user_id = $1
     WHERE si.event_mode
     ORDER BY si.start_date DESC, si.shift_id DESC
     LIMIT 1`,
    [userId],
  );
  if (shifts.length === 0) return null;
  const s = shifts[0];

  // Число неоткрытой карточки не уходит на клиент — только сам факт «тебя
  // ждут искры за Спарту». Админу, который смотрит карточку ребёнка, видно всё.
  const { rows: awards } = await pool.query<{
    id: number;
    title: string;
    amount: number | null;
    opened: boolean;
    in_rating: boolean;
    created_at: string;
  }>(
    `SELECT id::int, title,
            CASE WHEN opened_at IS NOT NULL OR $3::boolean THEN amount END AS amount,
            (opened_at IS NOT NULL) AS opened,
            in_rating,
            created_at
     FROM event_award
     WHERE shift_id = $1 AND user_id = $2
       ${revealAll ? "" : "AND published_at IS NOT NULL"}
     ORDER BY created_at, id`,
    [s.shift_id, userId, revealAll],
  );

  const { rows: prizes } = await pool.query<{
    amount: number;
    opened: boolean;
  }>(
    `SELECT amount, (opened_at IS NOT NULL) AS opened
     FROM event_prize WHERE shift_id = $1 AND user_id = $2`,
    [s.shift_id, userId],
  );

  // Число сундука уходит на клиент только после открытия — и админу, который
  // смотрит карточку ребёнка.
  const p = prizes[0];
  const prize = p
    ? {
        drawn: true,
        opened: p.opened,
        amount: p.opened || revealAll ? p.amount : null,
      }
    : null;

  // Счёт праздника — только по открытому: неоткрытая карточка ещё не вручена.
  const awarded = awards.reduce(
    (sum, a) => sum + (a.opened ? (a.amount ?? 0) : 0),
    0,
  );

  return {
    ...s,
    sparks: awarded + (p?.opened ? p.amount : 0),
    awards,
    prize,
  };
}

// Доска праздника: кто сколько набрал за день рождения. Видна участникам —
// смена берётся из ростера самого ребёнка, чужую доску так не запросить.
//
// В счёт идёт только засчитанное: объявленные награды и открытые сундуки. Тот,
// кто не открыл подарок, стоит без него — как и в общем рейтинге.
export async function getEventLeaderboard(
  userId: string,
): Promise<EventBoardEntry[]> {
  const { rows: shifts } = await pool.query<{ shift_id: number }>(
    `SELECT si.shift_id
     FROM shift_info si
     JOIN shift_members m ON m.shift_id = si.shift_id AND m.user_id = $1
     WHERE si.event_mode
     ORDER BY si.start_date DESC, si.shift_id DESC
     LIMIT 1`,
    [userId],
  );
  if (shifts.length === 0) return [];

  const { rows } = await pool.query<EventBoardEntry>(
    `WITH scores AS (
       SELECT m.user_id,
              COALESCE((
                SELECT SUM(a.amount) FROM event_award a
                WHERE a.shift_id = m.shift_id AND a.user_id = m.user_id
                  AND a.published_at IS NOT NULL AND a.opened_at IS NOT NULL
              ), 0)
              + COALESCE((
                SELECT p.amount FROM event_prize p
                WHERE p.shift_id = m.shift_id AND p.user_id = m.user_id
                  AND p.opened_at IS NOT NULL
              ), 0) AS sparks
       FROM shift_members m
       WHERE m.shift_id = $1
     )
     SELECT RANK() OVER (ORDER BY s.sparks DESC)::int AS rank,
            s.sparks::int AS sparks,
            u.id AS user_id, u.f_name, u.m_name, u.l_name,
            (u.id = $2) AS is_me
     FROM scores s
     JOIN user_main u ON u.id = s.user_id
     ORDER BY rank, u.l_name, u.f_name`,
    [shifts[0].shift_id, userId],
  );
  return rows;
}

// Ребёнок открыл карточку награды — «Твои искры за Спарту». Тем же нажатием
// искры и засчитываются. Открыть можно только свою и только объявленную:
// id приходит из тела запроса, поэтому проверяются оба условия.
export async function openAward(
  userId: string,
  awardId: number,
): Promise<MyEvent | null> {
  const { rowCount } = await pool.query(
    `UPDATE event_award SET opened_at = NOW()
     WHERE id = $1 AND user_id = $2
       AND published_at IS NOT NULL AND opened_at IS NULL`,
    [awardId, userId],
  );
  if (!rowCount) {
    // Повторное нажатие с другого устройства — не ошибка: карточка уже открыта.
    const { rowCount: mine } = await pool.query(
      "SELECT 1 FROM event_award WHERE id = $1 AND user_id = $2",
      [awardId, userId],
    );
    if (!mine) throw new AppError(404, "Награда не найдена");
  }
  return getMyEvent(userId);
}

// Ребёнок открыл сундук. Момент открытия и есть момент начисления: до него
// искры в рейтинг не идут. Отметка серверная — со второго устройства сундук не
// открыть заново, и число не переиграть.
export async function openPrize(userId: string): Promise<MyEvent | null> {
  const current = await getMyEvent(userId);
  if (!current?.prize?.drawn) {
    throw new AppError(404, "Сундук ещё не разыгран");
  }

  await pool.query(
    `UPDATE event_prize SET opened_at = NOW()
     WHERE shift_id = $1 AND user_id = $2 AND opened_at IS NULL`,
    [current.shift_id, userId],
  );
  return getMyEvent(userId);
}
