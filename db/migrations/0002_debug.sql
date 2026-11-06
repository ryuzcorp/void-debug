-- Probe tables for the Void compatibility checks. Applied by each
-- platform's own migration flow on deploy (celld `d1 migrations apply`
-- on Outer, the staged-generation migrate on Noite), so a successful
-- deploy already proves migrations work; the D1 check then exercises
-- live reads and writes against these tables.
CREATE TABLE IF NOT EXISTS debug_probe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
