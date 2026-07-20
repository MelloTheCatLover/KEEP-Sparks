-- Admin-visible plaintext mirror of a child's password. `passwd` (bcrypt) stays
-- the login secret; this column only lets an admin re-download the credentials
-- they hand out without resetting the password every time. Written alongside
-- `passwd` whenever a password is generated or set. NULL for accounts created
-- before this (their plaintext was never kept) — filled on first download.
ALTER TABLE user_main
  ADD COLUMN IF NOT EXISTS password_plain TEXT;
