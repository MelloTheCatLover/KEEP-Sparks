-- Фестиваль — биатлон по кругу. Отдельная от искр подсистема: своя гонка, свои
-- участники (просто номера, не дети), свои судьи со своим входом по PIN.
-- Ни одна таблица искр здесь не участвует и не изменяется: результаты
-- фестиваля не попадают ни в рейтинг, ни в достижения.
--
-- Модель: круг со стартом/финишной линией и N рубежами по порядку. Участник
-- идёт рубеж 1 → … → рубеж N → линия круга, и так `laps` раз. У каждого
-- участника свой судья: он идёт вместе с ним, отмечает каждый рубеж, закрывает
-- круг и вносит баллы за круг.

CREATE TABLE IF NOT EXISTS festival_race (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  -- Публичный адрес экрана показа: /festival/screen/<slug>. Секрета в нём нет,
  -- экран только читает.
  slug TEXT NOT NULL UNIQUE,
  laps INTEGER NOT NULL DEFAULT 3 CHECK (laps BETWEEN 1 AND 9),
  stations INTEGER NOT NULL DEFAULT 6 CHECK (stations BETWEEN 1 AND 12),
  -- Старт общий: одно время на всех, отсюда же считается время каждого.
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Названия рубежей — только подписи для экрана. Кодов у рубежей нет: судья
-- привязан к участнику, а не к точке.
CREATE TABLE IF NOT EXISTS festival_station (
  race_id INTEGER NOT NULL REFERENCES festival_race(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL CHECK (idx >= 1),
  name TEXT NOT NULL,
  PRIMARY KEY (race_id, idx)
);

CREATE TABLE IF NOT EXISTS festival_participant (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES festival_race(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number > 0),
  name TEXT NOT NULL,
  team TEXT,
  UNIQUE (race_id, number)
);

-- Судья = пара «человек + номер». Один участник — один судья, вход по PIN,
-- писать он может только своему участнику (проверяется в сервисе).
CREATE TABLE IF NOT EXISTS festival_judge (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES festival_race(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL UNIQUE
    REFERENCES festival_participant(id) ON DELETE CASCADE,
  name TEXT,
  -- Глобально уникален: по одному PIN и находим судью, логина нет.
  pin TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Сырые факты прохождения. Позиция участника, круг и время нигде не хранятся —
-- считаются из этих строк при чтении.
CREATE TABLE IF NOT EXISTS festival_event (
  id BIGSERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES festival_race(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL
    REFERENCES festival_participant(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('station', 'lap')),
  -- Номер рубежа у 'station'; у 'lap' (закрытие круга) его нет.
  station_idx INTEGER,
  lap INTEGER NOT NULL CHECK (lap >= 1),
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  judge_id INTEGER REFERENCES festival_judge(id) ON DELETE SET NULL,
  CHECK ((kind = 'station') = (station_idx IS NOT NULL))
);

-- Один рубеж на круге отмечается один раз. UNIQUE со station_idx = NULL не
-- сработал бы (NULL не равен NULL), поэтому два частичных индекса.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_festival_event_station
  ON festival_event (participant_id, lap, station_idx) WHERE kind = 'station';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_festival_event_lap
  ON festival_event (participant_id, lap) WHERE kind = 'lap';
CREATE INDEX IF NOT EXISTS idx_festival_event_race ON festival_event (race_id);

-- Баллы за круг: заработаны после его закрытия, поэтому привязаны к номеру
-- круга. Могут быть отрицательными (штраф); ноль бессмысленен.
CREATE TABLE IF NOT EXISTS festival_point (
  id BIGSERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES festival_race(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL
    REFERENCES festival_participant(id) ON DELETE CASCADE,
  lap INTEGER NOT NULL CHECK (lap >= 1),
  points INTEGER NOT NULL CHECK (points <> 0),
  note TEXT,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  judge_id INTEGER REFERENCES festival_judge(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_festival_point_race ON festival_point (race_id);
