-- Achievement catalogue with point values. Heart of the scoring system.
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  value INTEGER NOT NULL
);
