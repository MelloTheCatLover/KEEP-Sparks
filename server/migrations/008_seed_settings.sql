-- Achievement catalogue (17 actions) with point values. Idempotent:
-- re-running updates the value, keeps the id stable via UNIQUE(name).
INSERT INTO settings (name, value) VALUES
  -- Реалити-шоу
  ('reality_winner', 3500),
  ('reality_super_finalist', 500),
  ('reality_finalist', 150),
  ('reality_plot', 250),
  ('reality_leader', 50),
  -- Звёзды
  ('stars_winner', 2500),
  ('stars_finalist', 600),
  -- КТБ
  ('ktb_winner', 400),
  ('ktb_stage', 250),
  ('ktb_team_best', 500),
  -- КГГ / КТП
  ('kgg_winner', 500),
  ('kgg_mvp', 2000),
  ('kgg_cup', 100),
  -- Общие
  ('person_of_shift', 1500),
  ('person_of_day', 230),
  ('recognition', 1500),
  ('day', 30)
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
