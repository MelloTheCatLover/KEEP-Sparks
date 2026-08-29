-- Старт по шестёркам. Участники уходят на дистанцию группами, а не все разом,
-- поэтому группа — свойство участника, а её размер — свойство гонки (шестёрки
-- сегодня, пятёрки завтра).
--
-- На время это не влияет: отсчёт каждому включает его судья, и считается он от
-- личного старта. Группа нужна, чтобы понимать, кого выпускать следующим.
ALTER TABLE festival_race
  ADD COLUMN IF NOT EXISTS heat_size INTEGER NOT NULL DEFAULT 6
  CHECK (heat_size >= 1);

ALTER TABLE festival_participant
  ADD COLUMN IF NOT EXISTS heat INTEGER CHECK (heat >= 1);

-- Уже заведённые ростеры бьются по номерам: 1–6 первая шестёрка, 7–12 вторая.
UPDATE festival_participant SET heat = ((number - 1) / 6) + 1 WHERE heat IS NULL;
