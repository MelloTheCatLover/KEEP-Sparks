-- Wake Up Арена: 4 раунда за смену (2 на сменах в 5 дней), играют комнаты по
-- 5–6 человек. Победила комната — искры получает каждый её житель.
--
-- Комнаты — те же `shift_team`, третий вид состава рядом с КТБ и КТП: у них уже
-- есть состав, порядок и каскадное удаление. Отдельная таблица дала бы вторую
-- копию тех же связей.
ALTER TABLE shift_team DROP CONSTRAINT IF EXISTS shift_team_contest_check;
ALTER TABLE shift_team
  ADD CONSTRAINT shift_team_contest_check
  CHECK (contest IN ('ktb', 'ktp', 'room'));

-- Раунд арены. `day_number` — день смены, в который он прошёл (NULL =
-- последний день): искры за раунд открываются ребёнку вместе с этим днём, как
-- у этапа КТБ. `winner_team_id` пуст, пока раунд не подведён, — тогда он
-- никого не награждает.
CREATE TABLE IF NOT EXISTS arena_round (
  id BIGSERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT,
  day_number INTEGER,
  winner_team_id BIGINT REFERENCES shift_team(id) ON DELETE SET NULL,
  UNIQUE (shift_id, number)
);

CREATE INDEX IF NOT EXISTS idx_arena_round_shift ON arena_round (shift_id);
