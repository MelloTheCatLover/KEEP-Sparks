-- Manual spark adjustments granted by an admin, on top of the achievement-based
-- score. amount is signed: > 0 is a bonus (shown to the child in their cabinet),
-- < 0 is a penalty (applied to the total but hidden from the child). Both feed
-- every ranking total. reason is admin-only context, never shown to children.
CREATE TABLE spark_adjustments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spark_adjustments_user ON spark_adjustments (user_id);
