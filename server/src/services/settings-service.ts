import { pool } from "../config/db";
import { AppError } from "../middleware/error";
import {
  Legend,
  LegendItem,
  LegendShift,
  PriceWindow,
  Setting,
} from "../types/settings";
import { timezone } from "./reveal";

// Праздничное оформление сайта: включается само в дни смены-события (день
// рождения лагеря). Дата считается по лагерной таймзоне, а не по браузеру: у
// ребёнка в телефоне может стоять что угодно.
//
// Гаснет по `festive_until`, если она задана, — праздник длиннее самого дня
// рождения. Пусто — по последний день смены, как и было. Хардкода даты нет.
export async function getFestive(): Promise<{
  festive: boolean;
  name: string | null;
}> {
  const { rows } = await pool.query<{ name: string | null }>(
    `SELECT name FROM shift_info
     WHERE event_mode
       AND (now() AT TIME ZONE $1::text)::date
             BETWEEN start_date AND COALESCE(festive_until, end_date)
     ORDER BY start_date DESC
     LIMIT 1`,
    [timezone()],
  );
  return { festive: rows.length > 0, name: rows[0]?.name ?? null };
}

// Каталог с историей цен. `value` — последняя версия (по ней пойдут новые
// смены), `effective_value` — та, что действует сегодня; они расходятся, пока
// новый прайс объявлен, но ещё не наступил.
export async function list(): Promise<Setting[]> {
  const { rows } = await pool.query<Setting>(
    `SELECT s.id, s.name, s.value,
            (SELECT sp.value FROM setting_price sp
             WHERE sp.setting_id = s.id AND sp.valid_from <= CURRENT_DATE
             ORDER BY sp.valid_from DESC LIMIT 1) AS effective_value,
            COALESCE(
              (SELECT jsonb_agg(jsonb_build_object(
                        'valid_from', to_char(sp.valid_from, 'YYYY-MM-DD'),
                        'value', sp.value)
                      ORDER BY sp.valid_from DESC)
               FROM setting_price sp WHERE sp.setting_id = s.id),
              '[]'::jsonb
            ) AS prices
     FROM settings s
     ORDER BY s.id`,
  );
  return rows;
}

// Легенда «за что искры» для ребёнка. Цены каталога версионированы по дате
// начала смены, поэтому легенда всегда привязана к смене, а не к «сегодня»:
// иначе объявленный заранее прайс показал бы детям чужие числа.
//
// Опорная смена — та, что идёт сегодня; если смены нет — ближайшая будущая (к
// ней и готовятся), а после последней смены сезона — она сама. Смена-событие
// (день рождения лагеря) не в счёт: там награды ручные, каталог не при чём, и
// «Архив» (id=1) тоже — это псевдо-смена.
export async function getLegend(): Promise<Legend> {
  const { rows: shifts } = await pool.query<LegendShift>(
    `WITH today AS (SELECT (now() AT TIME ZONE $1::text)::date AS d)
     SELECT si.shift_id,
            si.name,
            si.start_date::text,
            si.end_date::text,
            cnt.person_count::int,
            ROUND(1 + (1 - EXP(-0.03 * (cnt.person_count - 10))), 2)::float8
              AS difficulty,
            CASE
              WHEN t.d BETWEEN si.start_date AND si.end_date THEN 'current'
              WHEN si.start_date > t.d THEN 'next'
              ELSE 'past'
            END AS state
     FROM shift_info si
     CROSS JOIN today t
     CROSS JOIN LATERAL (
       SELECT COALESCE(
         si.person_count_override,
         (SELECT COUNT(*) FROM shift_members m WHERE m.shift_id = si.shift_id)
       ) AS person_count
     ) cnt
     WHERE NOT si.event_mode AND si.shift_id <> 1
     ORDER BY CASE
                WHEN t.d BETWEEN si.start_date AND si.end_date THEN 0
                WHEN si.start_date > t.d THEN 1
                ELSE 2
              END,
              ABS(si.start_date - t.d)
     LIMIT 1`,
    [timezone()],
  );
  const shift = shifts[0] ?? null;

  // Цена = последняя версия не позже начала опорной смены. Без смены (пустая
  // база) остаётся сегодняшняя — показать всё равно что-то лучше, чем ничего.
  const { rows: items } = await pool.query<LegendItem>(
    `SELECT s.name, p.value
     FROM settings s
     JOIN LATERAL (
       SELECT sp.value FROM setting_price sp
       WHERE sp.setting_id = s.id
         AND sp.valid_from <= COALESCE($1::date, CURRENT_DATE)
       ORDER BY sp.valid_from DESC LIMIT 1
     ) p ON TRUE
     ORDER BY p.value DESC, s.id`,
    [shift?.start_date ?? null],
  );

  return { shift, items };
}

// Граница, за которой прошлое трогать нельзя: последняя смена, уже отдавшая
// искры детям — она в рейтинге или у неё есть раскрытый день. Новая версия цены
// обязана начинаться строго позже, иначе правка каталога переписала бы уже
// показанные детям результаты.
export async function getPriceWindow(): Promise<PriceWindow> {
  const locked = await pool.query<{ locked_until: string | null }>(
    `SELECT to_char(MAX(si.start_date), 'YYYY-MM-DD') AS locked_until
     FROM shift_info si
     WHERE si.in_rating
        OR EXISTS (
          SELECT 1 FROM shift_day sd
          WHERE sd.shift_id = si.shift_id AND sd.ready_at IS NOT NULL
        )`,
  );
  const lockedUntil = locked.rows[0]?.locked_until ?? null;

  const next = await pool.query<{
    shift_id: number;
    name: string | null;
    start_date: string;
  }>(
    `SELECT si.shift_id, si.name, si.start_date::text
     FROM shift_info si
     WHERE ($1::date IS NULL OR si.start_date > $1::date)
     ORDER BY si.start_date
     LIMIT 1`,
    [lockedUntil],
  );

  return { locked_until: lockedUntil, next_shift: next.rows[0] ?? null };
}

async function getById(id: number): Promise<Setting> {
  const all = await list();
  const found = all.find((s) => s.id === id);
  if (!found) throw new AppError(404, "Setting not found");
  return found;
}

// Объявить цену с даты. Цена НИКОГДА не правится задним числом: версия должна
// начинаться позже последней смены, которая уже отдала искры. Повторное
// объявление на ту же дату перезаписывает версию — так исправляется опечатка в
// ещё не наступившем прайсе.
export async function setPrice(
  id: number,
  validFrom: string,
  value: number,
): Promise<Setting> {
  const { locked_until } = await getPriceWindow();
  if (locked_until !== null && validFrom <= locked_until) {
    throw new AppError(
      400,
      `Цена может начинаться только после ${locked_until} — более ранние смены уже отдали искры детям`,
    );
  }

  const { rowCount } = await pool.query(
    `INSERT INTO setting_price (setting_id, valid_from, value)
     SELECT $1, $2::date, $3
     WHERE EXISTS (SELECT 1 FROM settings WHERE id = $1)
     ON CONFLICT (setting_id, valid_from) DO UPDATE SET value = EXCLUDED.value`,
    [id, validFrom, value],
  );
  if (!rowCount) throw new AppError(404, "Setting not found");

  await syncCurrentValue(id);
  return getById(id);
}

// Убрать ещё не наступившую версию — «передумали до смены».
export async function deletePrice(
  id: number,
  validFrom: string,
): Promise<Setting> {
  const { locked_until } = await getPriceWindow();
  if (locked_until !== null && validFrom <= locked_until) {
    throw new AppError(
      400,
      `Версия от ${validFrom} уже отработала на сменах — удалить её значит переписать выданные искры`,
    );
  }
  const { rowCount } = await pool.query(
    "DELETE FROM setting_price WHERE setting_id = $1 AND valid_from = $2::date",
    [id, validFrom],
  );
  if (!rowCount) throw new AppError(404, "Price version not found");

  await syncCurrentValue(id);
  return getById(id);
}

// `settings.value` — зеркало последней версии: цена, по которой пойдут новые
// смены. В подсчёте искр не участвует (там только `setting_price`), но её
// показывают каталоги и сетки, и разъезжаться она не должна.
async function syncCurrentValue(id: number): Promise<void> {
  await pool.query(
    `UPDATE settings s
     SET value = COALESCE(
       (SELECT sp.value FROM setting_price sp
        WHERE sp.setting_id = s.id
        ORDER BY sp.valid_from DESC LIMIT 1),
       s.value)
     WHERE s.id = $1`,
    [id],
  );
}
