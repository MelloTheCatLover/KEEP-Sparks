-- Explicit shift roster: which children attended a shift, independent of
-- whether they scored. person_count for the difficulty coefficient comes from
-- here (full roster), not just from who has achievements.
CREATE TABLE shift_members (
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id),
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  PRIMARY KEY (shift_id, user_id)
);

CREATE INDEX idx_shift_members_user ON shift_members(user_id);
