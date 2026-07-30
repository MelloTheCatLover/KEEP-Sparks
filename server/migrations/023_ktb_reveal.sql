-- Составы КТБ раздаются заранее, а ребёнок узнаёт свою команду в назначенный
-- час — «сундук» на дашборде. Между подготовкой и раскрытием состав уже лежит
-- в обычных shift_team/shift_team_member: этапы, баллы и подсчёт искр работают
-- без изменений, закрыто только чтение ребёнком.
--
-- Момент раскрытия — одна колонка у смены, а не у команды: узнают все сразу.
-- Правится сколько угодно раз, в том числе после наступления (тогда сундук
-- закрывается обратно — значит, админ понял, что состав неверный).
ALTER TABLE shift_info
  ADD COLUMN IF NOT EXISTS ktb_reveal_at TIMESTAMP WITH TIME ZONE;

-- Ребёнок открыл сундук. На сервере, а не в браузере: со второго устройства
-- сундук не должен открыться заново.
CREATE TABLE ktb_team_opened (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shift_id, user_id)
);
