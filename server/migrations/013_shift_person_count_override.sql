-- When set, this value is used instead of the roster size to compute a shift's
-- difficulty coefficient. Used by the pre-83 "Архив" shift, which aggregates
-- many children but is scored as for a 40-child shift.
ALTER TABLE shift_info ADD COLUMN person_count_override INTEGER;
