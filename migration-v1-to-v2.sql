-- Migration from v1 schema to v2
-- Run after existing tables exist

-- 1. Create the new lists table
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT DEFAULT '🎁',
  accent TEXT DEFAULT '#c084fc',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Create the new tags tables
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL REFERENCES items(id),
  tag_id TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (item_id, tag_id)
);

-- 3. Create the activity table
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT REFERENCES items(id),
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 4. Add new columns to items (safe if already exists in some SQLite versions)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle errors
-- D1 allows individual ALTER TABLE ADD COLUMN

ALTER TABLE items ADD COLUMN list_id TEXT REFERENCES lists(id);
ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN claimed_by TEXT REFERENCES users(id);
ALTER TABLE items ADD COLUMN claimed_at TEXT;