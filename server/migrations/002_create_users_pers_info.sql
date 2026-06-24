-- Per-child extra info. One-to-one with user_main.
CREATE TABLE user_pers_info (
  user_id UUID PRIMARY KEY REFERENCES user_main(id) ON DELETE CASCADE,
  gender VARCHAR(50) NOT NULL,
  date_of_birth DATE NOT NULL,
  height INTEGER NOT NULL CHECK (height > 0)
);
