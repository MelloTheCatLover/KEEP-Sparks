-- Техобслуживание: сайт закрывается для детей одним флагом, без пересборки
-- контейнеров. Флаг живёт в базе, а не в переменной окружения, именно поэтому —
-- переключается на ходу, из админки.
--
-- Таблица однострочная (id = 1): состояний приложения одно, и заводить под него
-- ключ-значение не за чем.
CREATE TABLE app_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  -- Что показать ребёнку на заглушке. Пусто — текст по умолчанию.
  message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO app_state (id, maintenance) VALUES (1, FALSE)
ON CONFLICT DO NOTHING;
