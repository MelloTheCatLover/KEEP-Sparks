// Сезон лагеря — от дня рождения до дня рождения (2 августа). Смена относится
// к сезону по дате окончания: закончилась 2 августа или позже — уже новый
// сезон. Поэтому смена, на которую выпал день рождения (130: 30.07–08.08),
// открывает новый сезон, а не закрывает старый.
//
// Сезон обозначается годом начала: 2026 = «2026/27». Хранить его негде и не
// нужно — он выводится из даты при чтении, как и всё производное в искрах.
// «Архив» (агрегат за годы до 83 смены, `person_count_override`) ни в один
// сезон не входит: его дата условная.
export const SEASON_START_MMDD = "08-02";

// SQL: сезон смены по алиасу `shift_info`.
export function seasonOfSql(alias: string): string {
  return `(EXTRACT(YEAR FROM ${alias}.end_date)::int
    - CASE WHEN to_char(${alias}.end_date, 'MM-DD') < '${SEASON_START_MMDD}'
           THEN 1 ELSE 0 END)`;
}

// SQL-предикат: смена `alias` входит в сезон из плейсхолдера `param` ("$1").
export function inSeasonSql(alias: string, param: string): string {
  return `(${alias}.person_count_override IS NULL
    AND ${seasonOfSql(alias)} = ${param}::int)`;
}

export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}
