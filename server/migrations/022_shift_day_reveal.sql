-- Раскрытие дня ждёт двух условий: админ подвёл день (всё введено) и наступило
-- 12:00. Одного времени мало — иначе ребёнок откроет полупустой день, а искры
-- дозальются позже и итог прыгнет.
--
-- Заодно дневные искры хранятся по достижениям, а не одним числом: карточка
-- «твои искры за вчера» показывает, за что именно они пришли.

-- 021 завела агрегат по дню; заменяем на разбивку. Таблица была пустая.
DROP TABLE IF EXISTS shift_day_xp;

CREATE TABLE shift_day_award (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  setting_id INTEGER NOT NULL REFERENCES settings(id),
  amount INTEGER NOT NULL,
  PRIMARY KEY (shift_id, user_id, day_number, setting_id)
);

CREATE INDEX idx_shift_day_award_user ON shift_day_award (user_id);

-- День смены подведён: админ сказал «за этот день всё введено». Пока ready_at
-- пуст, день не раскрывается, сколько бы времени ни прошло.
CREATE TABLE shift_day (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  ready_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (shift_id, day_number)
);

-- Ребёнок открыл карточку дня. Хранится на сервере, а не в браузере: иначе с
-- другого устройства карточка пришла бы второй раз.
CREATE TABLE shift_day_opened (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shift_id, user_id, day_number)
);
