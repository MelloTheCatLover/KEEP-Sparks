-- Camp shifts. Shift numbers are not contiguous (83, 84, 90, 94...).
CREATE TABLE shift_info (
  shift_id INTEGER PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  person_of_the_shift UUID REFERENCES user_main(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TRIGGER trg_shift_info_updated_at
  BEFORE UPDATE ON shift_info
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
