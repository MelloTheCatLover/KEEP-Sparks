-- Manual "current rating" opt-out. A child is in the current ranking when this
-- flag is true AND they are under 18 (age computed at read from date_of_birth).
-- The overall ranking ignores this flag entirely.
ALTER TABLE user_main
  ADD COLUMN in_current_rating BOOLEAN NOT NULL DEFAULT TRUE;
