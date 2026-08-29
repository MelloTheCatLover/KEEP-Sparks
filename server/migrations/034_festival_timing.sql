-- Фестиваль: индивидуальный отсчёт и штрафы.
--
-- Было: общий старт от админа, время каждого считалось от одного момента.
-- Стало: отсчёт участнику включает его собственный судья — на площадке номера
-- уходят не разом, и общий секундомер врал бы тем, кто стартовал позже.
-- Момент старта — такое же сырое событие, как прохождение рубежа.
ALTER TABLE festival_event DROP CONSTRAINT IF EXISTS festival_event_kind_check;
ALTER TABLE festival_event
  ADD CONSTRAINT festival_event_kind_check
  CHECK (kind IN ('start', 'station', 'lap'));

-- Старт у участника один. `station_idx` у него пуст — это уже проверяет
-- CHECK ((kind = 'station') = (station_idx IS NOT NULL)) из миграции 033.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_festival_event_start
  ON festival_event (participant_id) WHERE kind = 'start';

-- Штраф: одна строка = один штраф, к итоговому времени добавляется
-- `penalty_seconds` секунд. Цена штрафа живёт на гонке, а не в коде: правило
-- «+15 секунд» может смениться от фестиваля к фестивалю.
ALTER TABLE festival_race
  ADD COLUMN IF NOT EXISTS penalty_seconds INTEGER NOT NULL DEFAULT 15
  CHECK (penalty_seconds >= 0);

CREATE TABLE IF NOT EXISTS festival_penalty (
  id BIGSERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES festival_race(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL
    REFERENCES festival_participant(id) ON DELETE CASCADE,
  lap INTEGER NOT NULL CHECK (lap >= 1),
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  judge_id INTEGER REFERENCES festival_judge(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_festival_penalty_race ON festival_penalty (race_id);

-- Комментарий к баллам не прижился: судья на бегу его не пишет, а на экране
-- показа он не помещается.
ALTER TABLE festival_point DROP COLUMN IF EXISTS note;
