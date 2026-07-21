-- «Ведение смены»: сырые факты традиций (реалити, КТБ, КТП, человек дня…),
-- из которых достижения смены пересчитываются целиком. Таблицы описывают то,
-- что произошло; achievements остаётся производным — как и искры.
--
-- Пишутся только сменами с live_mode = true. Флаг защищает 19 исторических
-- смен, залитых из xlsx: у них сырых фактов нет, и пересчёт обнулил бы их.
ALTER TABLE shift_info
  ADD COLUMN IF NOT EXISTS live_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Именные награды: один ребёнок — одна строка. kind совпадает с settings.name
-- (reality_winner, reality_leader, person_of_day, recognition, kgg_mvp,
-- ktb_team_best, person_of_shift…). day_number = 0 для наград «в конце смены»,
-- 1..N для ежедневных (лучший в реалити, человек дня).
CREATE TABLE shift_award (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  day_number INTEGER NOT NULL DEFAULT 0,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  PRIMARY KEY (shift_id, kind, day_number, user_id)
);

CREATE INDEX idx_shift_award_user ON shift_award (user_id);

-- Команды смены. contest: 'ktb' или 'ktp'. У КТП названия задаются заранее,
-- у КТБ обычно номера — то и другое ложится в name.
CREATE TABLE shift_team (
  id BIGSERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  contest TEXT NOT NULL CHECK (contest IN ('ktb', 'ktp')),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (shift_id, contest, name)
);

CREATE TABLE shift_team_member (
  team_id BIGINT NOT NULL REFERENCES shift_team(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- Этапы КТБ. Итог этапа подводится расстановкой баллов по командам: балльная
-- шкала своя у каждого этапа, поэтому хранятся сами баллы, а не места.
CREATE TABLE ktb_stage (
  id BIGSERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT,
  UNIQUE (shift_id, number)
);

CREATE TABLE ktb_stage_score (
  stage_id BIGINT NOT NULL REFERENCES ktb_stage(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES shift_team(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (stage_id, team_id)
);

-- Кубки КТП: кубок выдаётся команде, каждому её участнику пишется kgg_cup.
CREATE TABLE ktp_cup (
  id BIGSERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES shift_team(id) ON DELETE CASCADE,
  title TEXT
);

-- Ручной выбор победителя контеста админом. Нужен при равенстве (одинаковое
-- число кубков в КТП, одинаковая сумма баллов в КТБ); при явном лидере не
-- заполняется и победитель считается сам.
CREATE TABLE shift_contest_winner (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  contest TEXT NOT NULL CHECK (contest IN ('ktb', 'ktp')),
  team_id BIGINT NOT NULL REFERENCES shift_team(id) ON DELETE CASCADE,
  PRIMARY KEY (shift_id, contest)
);
