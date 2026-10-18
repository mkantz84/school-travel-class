-- Add per-expense family selection column (Splitwise-style) and enforce unique family names
ALTER TABLE expenses ADD COLUMN split_families TEXT DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_families_name_unique ON families(name);
