-- Add AI & admin fields to trips, meals, and gear, plus agent_runs & agent_suggestions tables
ALTER TABLE trips ADD COLUMN expected_people INTEGER DEFAULT 0;
ALTER TABLE trips ADD COLUMN image_url TEXT DEFAULT '';
ALTER TABLE trips ADD COLUMN image_style TEXT DEFAULT '';
ALTER TABLE trips ADD COLUMN image_data TEXT DEFAULT '';
ALTER TABLE trips ADD COLUMN ai_status TEXT DEFAULT '';

ALTER TABLE meals ADD COLUMN source TEXT DEFAULT 'user';
ALTER TABLE meals ADD COLUMN ai_key TEXT DEFAULT '';

ALTER TABLE gear ADD COLUMN source TEXT DEFAULT 'user';
ALTER TABLE gear ADD COLUMN ai_key TEXT DEFAULT '';
ALTER TABLE gear ADD COLUMN quantity TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  trip_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT DEFAULT '',
  error TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  trip_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  needed_for TEXT DEFAULT '',
  ai_key TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_trip ON agent_runs(trip_id);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_run ON agent_suggestions(run_id);
