-- Families of the class
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parents TEXT DEFAULT '',
  kids_names TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  adults INTEGER NOT NULL DEFAULT 2,
  kids INTEGER NOT NULL DEFAULT 1,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  destination TEXT DEFAULT '',
  meeting_time TEXT DEFAULT '',
  meeting_place TEXT DEFAULT '',
  lodging TEXT DEFAULT '',
  lodging_phone TEXT DEFAULT '',
  lodging_details TEXT DEFAULT '',
  missing_items TEXT DEFAULT '',
  food_notes TEXT DEFAULT '',
  schedule TEXT DEFAULT '',
  focalizer_family_id INTEGER,
  focalizer_name TEXT DEFAULT '',
  focalizer_phone TEXT DEFAULT '',
  tools_name TEXT DEFAULT '',
  tools_phone TEXT DEFAULT '',
  included_expenses TEXT DEFAULT '',
  plans_deadline TEXT DEFAULT '',
  final_check TEXT DEFAULT '',
  gear_keeper TEXT DEFAULT '',
  shortages TEXT DEFAULT '',
  status TEXT DEFAULT 'planning',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Which families join each trip and with how many people (varies per trip)
CREATE TABLE IF NOT EXISTS participants (
  trip_id INTEGER NOT NULL,
  family_id INTEGER NOT NULL,
  adults INTEGER NOT NULL DEFAULT 0,
  kids INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (trip_id, family_id)
);

-- Meals / food tasks
CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  responsible TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  menu TEXT DEFAULT '',
  helpers TEXT DEFAULT '',
  tools TEXT DEFAULT '',
  plan_received INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0
);

-- Focalizer checklist
CREATE TABLE IF NOT EXISTS checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  done_by TEXT DEFAULT '',
  done_at TEXT DEFAULT '',
  sort INTEGER DEFAULT 0
);

-- Shared expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  family_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  included INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meals_trip ON meals(trip_id);
CREATE INDEX IF NOT EXISTS idx_check_trip ON checklist(trip_id);
CREATE INDEX IF NOT EXISTS idx_exp_trip ON expenses(trip_id);
