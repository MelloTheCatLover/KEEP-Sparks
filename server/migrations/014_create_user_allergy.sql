-- Allergy / dietary notes for a child. One row per item (many-to-one), kept
-- out of user_pers_info so the freeform source stays queryable per item.
CREATE TABLE user_allergy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  item TEXT NOT NULL
);

CREATE INDEX idx_user_allergy_user_id ON user_allergy(user_id);
