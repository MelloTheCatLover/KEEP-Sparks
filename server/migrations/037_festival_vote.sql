-- Финальное голосование зрителей: на экране QR, в руках телефон, один выбор.
--
-- Кандидатов отмечает админ: «финалист» — флаг на участнике гонки, а не
-- отдельный список, иначе номер и цвет пришлось бы дублировать.
--
-- Голос анонимный: имени голосующего нет, есть только ключ устройства —
-- чтобы один телефон не проголосовал дважды. От накрутки он не защищает
-- (очистил хранилище — голосуй снова), но случайный второй тап и «дай я тоже
-- нажму с твоего» отсекает. Для лагерного зала этого достаточно.
ALTER TABLE festival_participant
  ADD COLUMN IF NOT EXISTS finalist BOOLEAN NOT NULL DEFAULT FALSE;

-- Голосование открывается отдельно от гонки: бежали днём, выбирают вечером.
ALTER TABLE festival_race
  ADD COLUMN IF NOT EXISTS voting_open BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS festival_vote (
  id BIGSERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES festival_race(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL
    REFERENCES festival_participant(id) ON DELETE CASCADE,
  device TEXT NOT NULL,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (race_id, device)
);

CREATE INDEX IF NOT EXISTS festival_vote_tally_idx
  ON festival_vote (race_id, participant_id);
