-- Decentralized gear items per trip (needed by meal leaders, claimed by families)
CREATE TABLE IF NOT EXISTS gear (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  needed_for TEXT DEFAULT '',
  brought_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gear_trip ON gear(trip_id);
