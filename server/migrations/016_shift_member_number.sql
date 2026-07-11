-- Starting number assigned to a child on a shift (from "Генерация номеров").
-- Persisted so the shift page can show it after a refresh; null until generated.
ALTER TABLE shift_members
  ADD COLUMN number INTEGER;
