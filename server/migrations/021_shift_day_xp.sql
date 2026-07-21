-- Сырые (без коэффициента) искры ребёнка за один день смены. Заполняется тем
-- же пересчётом, что пишет achievements (live-service), — единственный путь.
--
-- Зачем отдельная таблица: achievements агрегирует смену целиком, без дней, а
-- ребёнку искры открываются по дням (в 12:00 следующего дня). Считать «сколько
-- уже открыто» иначе пришлось бы, повторяя правила традиций в SQL.
--
-- Коэффициент сюда НЕ применяется: он пер-смена и накладывается при чтении,
-- один раз, к нарастающей сумме — иначе округление по дням не сойдётся с итогом.
CREATE TABLE shift_day_xp (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  PRIMARY KEY (shift_id, user_id, day_number)
);

CREATE INDEX idx_shift_day_xp_user ON shift_day_xp (user_id);
