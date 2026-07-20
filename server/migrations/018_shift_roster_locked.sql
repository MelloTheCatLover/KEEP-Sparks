-- Manual "shift closed" flag. While false, an admin may re-sync the roster from
-- a pasted ФИО list (add + remove). Once results are in and the admin sets this
-- true, roster sync is refused so a loaded shift's members cannot shift under it.
ALTER TABLE shift_info
  ADD COLUMN IF NOT EXISTS roster_locked BOOLEAN NOT NULL DEFAULT FALSE;
