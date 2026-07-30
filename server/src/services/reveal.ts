import { env } from "../config/env";

// Раскрытие искр ведущейся смены. День открывается ребёнку, когда сошлось
// двое: админ **подвёл день** (`shift_day.ready_at`) и наступило 12:00 по
// времени лагеря. Одного времени мало — иначе ребёнок откроет полупустой день,
// а искры дозальются позже и итог прыгнет.
//
// Если день подвели после полудня, он ждёт следующего — искры всегда приходят
// в один и тот же час, а не когда админ закончил вводить.
//
// Фильтр применяется на сервере, а не в UI: дети открывают инструменты
// разработчика.

// Таймзона попадает прямо в SQL-литерал, поэтому пропускаем только то, из чего
// состоят имена зон в базе IANA.
const SAFE_TZ = /^[A-Za-z0-9/_+-]+$/;

// Таймзона лагеря. Экспортируется, потому что по ней же разбирается введённое
// админом «настенное» время раскрытия составов КТБ.
export function timezone(): string {
  const tz = env.sparks.timezone;
  if (!SAFE_TZ.test(tz)) {
    throw new Error(`Bad SPARKS_TIMEZONE: ${tz}`);
  }
  return tz;
}

function revealHour(): number {
  const h = env.sparks.revealHour;
  if (!Number.isInteger(h) || h < 0 || h > 23) {
    throw new Error(`Bad SPARKS_REVEAL_HOUR: ${env.sparks.revealHour}`);
  }
  return h;
}

// Штатный момент раскрытия дня: 12:00 следующего дня. `startDate` — колонка с
// датой старта смены, `day` — выражение с номером дня.
export function nominalRevealSql(startDate: string, day: string): string {
  return `((${startDate} + ${day})::timestamp + make_interval(hours => ${revealHour()}))
          AT TIME ZONE '${timezone()}'`;
}

// Ближайшее 12:00, наступившее не раньше `ts`. Момент подведения дня после
// полудня переносится на следующий.
function noonAtOrAfterSql(ts: string): string {
  const h = revealHour();
  const tz = timezone();
  const local = `(${ts} AT TIME ZONE '${tz}')`;
  return `(((${local})::date
            + CASE WHEN (${local})::time <= make_time(${h}, 0, 0) THEN 0 ELSE 1 END)::timestamp
           + make_interval(hours => ${h})) AT TIME ZONE '${tz}'`;
}

// Фактический момент раскрытия: позднее из штатного и первого полудня после
// подведения дня. NULL, пока день не подведён.
export function effectiveRevealSql(
  startDate: string,
  day: string,
  readyAt: string,
): string {
  return `CASE WHEN ${readyAt} IS NULL THEN NULL
               ELSE GREATEST(${nominalRevealSql(startDate, day)},
                             ${noonAtOrAfterSql(readyAt)})
          END`;
}

// Предикат «этот день уже открыт ребёнку».
export function revealedSql(
  startDate: string,
  day: string,
  readyAt: string,
): string {
  return `${effectiveRevealSql(startDate, day, readyAt)} <= now()`;
}
