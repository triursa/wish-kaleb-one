-- Wishlist D1 Schema v2.1 — Named lists with claiming, tags, occasions, price tracking

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
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT DEFAULT '🎁',
  accent TEXT DEFAULT '#c084fc',
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
  priority INTEGER DEFAULT 0,
  claimed_by TEXT REFERENCES users(id),
  claimed_at TEXT,
  purchased INTEGER DEFAULT 0,
  purchased_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT,
  occasion_id TEXT REFERENCES occasions(id)
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
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT REFERENCES items(id),
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS occasions (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  emoji TEXT DEFAULT '🎉',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  price TEXT NOT NULL,
  scraped_at TEXT DEFAULT (datetime('now'))
);
