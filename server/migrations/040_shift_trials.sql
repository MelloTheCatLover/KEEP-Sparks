-- Испытания смены: внутренняя игра со своими баллами (впервые — 134 смена,
-- «Разбитый парк»). Баллы испытаний с искрами не связаны: ни в achievements, ни
-- в общий рейтинг лагеря не идут — у игры свой зачёт внутри смены.
--
-- Испытание = день смены + название. В день их может быть несколько.
-- published_at NULL = баллы загружены, но дети их ещё не видят: админ сверяет
-- таблицу и открывает испытание сам.
CREATE TABLE trial (
  id BIGSERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  day SMALLINT NOT NULL CHECK (day >= 1),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, day, title)
);

CREATE INDEX idx_trial_shift ON trial (shift_id, day);

-- Баллы ребёнка за испытание. Дробные допустимы: судьи ставят и «7,5».
-- Нет строки — ребёнок в испытании не участвовал (в зачёт смены идёт 0).
CREATE TABLE trial_score (
  trial_id BIGINT NOT NULL REFERENCES trial(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  points NUMERIC(10, 2) NOT NULL,
  PRIMARY KEY (trial_id, user_id)
);

CREATE INDEX idx_trial_score_user ON trial_score (user_id);

-- Баллы только участнику смены: третий рубеж после разбора на клиенте и
-- сопоставления по ростеру в сервисе.
CREATE OR REPLACE FUNCTION trial_score_member_check()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM trial t
    JOIN shift_members m ON m.shift_id = t.shift_id AND m.user_id = NEW.user_id
    WHERE t.id = NEW.trial_id
  ) THEN
    RAISE EXCEPTION 'trial_score: user % is not on the trial''s shift', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trial_score_member
  BEFORE INSERT OR UPDATE ON trial_score
  FOR EACH ROW EXECUTE FUNCTION trial_score_member_check();
