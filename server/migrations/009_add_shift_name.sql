-- Shifts have human names (Спарта, Путь воина, …). Seeded in 010.
ALTER TABLE shift_info ADD COLUMN IF NOT EXISTS name TEXT;
