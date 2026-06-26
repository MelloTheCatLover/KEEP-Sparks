-- Some shifts are recorded for their detail page but must not feed the global
-- ranking (e.g. shift 120 "ИГРА" — a one-off stars event that would skew the
-- cumulative sparks). Flag them here; the sparks calculator filters on it.
ALTER TABLE shift_info
  ADD COLUMN IF NOT EXISTS in_rating BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE shift_info SET in_rating = FALSE WHERE shift_id = 120;
