-- Розыгрыш на празднике: сундук с случайным числом искр каждому участнику.
-- Число разыгрывает сервер (crypto), а не браузер, — иначе его подобрали бы
-- перезагрузкой страницы.
--
-- Искры засчитываются по `opened_at`: приз получает тот, кто открыл сундук.
-- До открытия число ребёнку не отдаётся вовсе — в ответе API его нет.
CREATE TABLE event_prize (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  drawn_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (shift_id, user_id)
);

CREATE INDEX idx_event_prize_user ON event_prize (user_id);
