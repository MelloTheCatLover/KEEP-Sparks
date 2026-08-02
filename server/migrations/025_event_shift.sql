-- Смена-событие (день рождения лагеря): ростер есть, традиций нет. Ни
-- live_mode, ни in_rating — пересчёт достижений, человек дня, КТБ и КТП её не
-- касаются вовсе. Искры выдаются вручную: название придумывает админ, число
-- вводит руками.
ALTER TABLE shift_info
  ADD COLUMN IF NOT EXISTS event_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Награда за действие на празднике: «Реалити-шоу Затмение» +150.
--
-- Коэффициент сложности смены НЕ применяется, в отличие от achievements: админ
-- объявляет со сцены точное число, и ребёнок должен увидеть ровно его, а не
-- умноженное на размер ростера.
--
-- published_at NULL = награда выдана, но ещё не объявлена: ребёнок её не видит
-- и в рейтинг она не идёт. Флаг у каждой строки свой — реалити закончилось,
-- его награды открыли, остальные ждут своей сцены.
CREATE TABLE event_award (
  id BIGSERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_award_user ON event_award (user_id);
CREATE INDEX idx_event_award_shift ON event_award (shift_id, published_at);
