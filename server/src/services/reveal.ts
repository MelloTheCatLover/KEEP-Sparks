import { env } from "../config/env";

// Раскрытие искр ведущейся смены. Всё, что ребёнок заработал в день N, он
// видит в 12:00 дня N+1 по времени лагеря: админ вносит итоги ночью, ребёнок
// утром находит прирост. Момент — чистая функция от номера дня и даты старта
// смены, поэтому не хранится: правка уже открытого дня его не спрячет.
//
// Фильтр применяется на сервере, а не в UI: дети открывают инструменты
// разработчика.

// Таймзона попадает прямо в SQL-литерал, поэтому пропускаем только то, из чего
// состоят имена зон в базе IANA.
const SAFE_TZ = /^[A-Za-z0-9/_+-]+$/;

function timezone(): string {
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

// SQL-выражение момента раскрытия дня: `startDate` — колонка с датой старта
// смены, `day` — выражение с номером дня.
export function revealAtSql(startDate: string, day: string): string {
  return `((${startDate} + ${day})::timestamp + make_interval(hours => ${revealHour()}))
          AT TIME ZONE '${timezone()}'`;
}

// Предикат «этот день уже открыт ребёнку».
export function revealedSql(startDate: string, day: string): string {
  return `${revealAtSql(startDate, day)} <= now()`;
}
