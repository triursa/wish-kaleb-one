-- Wishlist D1 Schema v2 — Named lists with claiming

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  owner_id TEXT,                          -- NULL = shared/managed list (like Teddy)
  name TEXT NOT NULL,                     -- "Kaleb List", "Mindy List", "Teddy List"
  slug TEXT NOT NULL UNIQUE,              -- "kaleb", "mindy", "teddy"
  emoji TEXT DEFAULT '🎁',
  accent TEXT DEFAULT '#c084fc',          -- Per-list accent color
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  price TEXT,
  image_url TEXT,
  store_name TEXT,
  notes TEXT,
  added_by TEXT NOT NULL REFERENCES users(id),
  priority INTEGER DEFAULT 0,             -- 0=normal, 1=high, 2=must-have
  claimed_by TEXT REFERENCES users(id),   -- Who claimed it (hidden from list owner)
  claimed_at TEXT,
  purchased INTEGER DEFAULT 0,            -- Marked as received/delivered
  purchased_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL REFERENCES items(id),
  tag_id TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  action TEXT NOT NULL,                    -- "added", "claimed", "unclaimed", "purchased", "priority_changed", "deleted"
  actor_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT REFERENCES items(id),
  metadata TEXT,                           -- JSON blob
  created_at TEXT DEFAULT (datetime('now'))
);