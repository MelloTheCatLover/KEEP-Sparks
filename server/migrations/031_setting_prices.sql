-- Цены каталога с версиями по датам. До этой миграции цена достижения была
-- одна на всю историю (`settings.value`), и правка цены задним числом
-- переписывала искры всем и за все смены: производные значения считаются при
-- чтении, старый результат нигде не зафиксирован.
--
-- Теперь цена берётся на дату НАЧАЛА смены. Прошлые смены навсегда остаются на
-- своих ценах, новая система включается со смены 133 «Голос Улиц»
-- (2026-08-13) — первой, у которой на момент врезки не было ни одного
-- раскрытого дня.
CREATE TABLE IF NOT EXISTS setting_price (
  setting_id INTEGER NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 0),
  PRIMARY KEY (setting_id, valid_from)
);

-- Новая награда: победа в Wake Up Арене. Играется комнатами по 5–6 человек,
-- 4 раунда за смену (2 на пятидневках); искры получает каждый в победившей
-- комнате — награда командная, как этап КТБ.
INSERT INTO settings (name, value)
VALUES ('wake_up_arena_winner', 300)
ON CONFLICT (name) DO NOTHING;

-- Базовая версия «действует всегда» = цена, по которой уже посчитаны все
-- прошлые смены. Строка обязана быть у каждого достижения: расчёт берёт
-- последнюю версию не позже начала смены, и достижение без версии просто
-- выпало бы из подсчёта.
INSERT INTO setting_price (setting_id, valid_from, value)
SELECT id, DATE '1970-01-01', value FROM settings
ON CONFLICT DO NOTHING;

-- Новый прайс со смены 133 (2026-08-13). Идея правки — сжать верхушку:
-- дорогие личные награды дешевеют, массовое и командное дорожает. Победа в
-- реалити остаётся самой дорогой наградой каталога.
INSERT INTO setting_price (setting_id, valid_from, value)
SELECT s.id, DATE '2026-08-13', v.value
FROM (VALUES
  ('reality_winner', 3000),          -- было 3500, всё ещё вершина каталога
  ('stars_winner', 2000),            -- было 2500
  ('kgg_mvp', 1500),                 -- было 2000
  ('person_of_shift', 1300),         -- было 1500
  ('recognition', 1200),             -- было 1500
  ('stars_finalist', 600),           -- без изменений
  ('ktb_team_best', 600),            -- было 500
  ('kgg_winner', 500),               -- без изменений
  ('reality_super_finalist', 500),   -- без изменений
  ('ktb_winner', 400),               -- без изменений
  ('person_of_day', 300),            -- было 230: самый дешёвый способ отметить многих
  ('wake_up_arena_winner', 300),     -- новая награда
  ('ktb_stage', 250),                -- без изменений
  ('reality_plot', 250),             -- без изменений
  ('reality_finalist', 200),         -- было 150
  ('kgg_cup', 150),                  -- было 100
  ('reality_leader', 80),            -- было 50
  ('day', 30)                        -- без изменений
) AS v(name, value)
JOIN settings s ON s.name = v.name
ON CONFLICT (setting_id, valid_from) DO UPDATE SET value = EXCLUDED.value;

-- `settings.value` с этого момента — цена ПОСЛЕДНЕЙ версии, то есть та, по
-- которой будут считаться новые смены. В подсчёте искр она больше не
-- участвует: расчёт идёт только через `setting_price`.
UPDATE settings s
SET value = p.value
FROM (
  SELECT DISTINCT ON (setting_id) setting_id, value
  FROM setting_price
  ORDER BY setting_id, valid_from DESC
) p
WHERE p.setting_id = s.id;

-- Достижение с ценой, действовавшей на его смене. Всё, что считает искры,
-- читает эти представления вместо `achievements × settings`: цена берётся по
-- дате начала смены, поэтому прошлое не переписывается никогда.
CREATE OR REPLACE VIEW achievement_xp AS
SELECT a.user_id, a.shift_id, a.setting_id, a.amount,
       p.value AS price, a.amount * p.value AS xp
FROM achievements a
JOIN shift_info si ON si.shift_id = a.shift_id
JOIN LATERAL (
  SELECT sp.value
  FROM setting_price sp
  WHERE sp.setting_id = a.setting_id AND sp.valid_from <= si.start_date
  ORDER BY sp.valid_from DESC
  LIMIT 1
) p ON TRUE;

CREATE OR REPLACE VIEW shift_day_award_xp AS
SELECT d.shift_id, d.user_id, d.day_number, d.setting_id, d.amount,
       p.value AS price, d.amount * p.value AS xp
FROM shift_day_award d
JOIN shift_info si ON si.shift_id = d.shift_id
JOIN LATERAL (
  SELECT sp.value
  FROM setting_price sp
  WHERE sp.setting_id = d.setting_id AND sp.valid_from <= si.start_date
  ORDER BY sp.valid_from DESC
  LIMIT 1
) p ON TRUE;

-- Прайс-лист каждой смены целиком — для сеток и аналитики, где цена нужна и
-- там, где достижения нет.
CREATE OR REPLACE VIEW shift_setting_price AS
SELECT si.shift_id, s.id AS setting_id, s.name, p.value
FROM shift_info si
CROSS JOIN settings s
JOIN LATERAL (
  SELECT sp.value
  FROM setting_price sp
  WHERE sp.setting_id = s.id AND sp.valid_from <= si.start_date
  ORDER BY sp.valid_from DESC
  LIMIT 1
) p ON TRUE;
