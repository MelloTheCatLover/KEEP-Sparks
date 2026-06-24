-- Person of the day. Several per day possible -> one row each.
-- Composite PK: (day_number, shift_id, user_id).
CREATE TABLE people_of_the_day (
  day_number INTEGER NOT NULL,
  shift_id INTEGER NOT NULL REFERENCES shift_info(shift_id),
  user_id UUID NOT NULL REFERENCES user_main(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  PRIMARY KEY (day_number, shift_id, user_id)
);
