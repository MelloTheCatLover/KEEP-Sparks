-- One row = one achievement of one child on one shift. Normalised.
-- Score: amount * settings.value, then SUM over the wanted selection.
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id),
  setting_id INTEGER NOT NULL REFERENCES settings(id),
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  UNIQUE (user_id, shift_id, setting_id)
);

CREATE INDEX idx_achievements_user_id ON achievements(user_id);
CREATE INDEX idx_achievements_shift_id ON achievements(shift_id);
