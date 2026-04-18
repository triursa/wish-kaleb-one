-- Wishlist D1 Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  price TEXT,
  image_url TEXT,
  store_name TEXT,
  notes TEXT,
  added_by TEXT NOT NULL REFERENCES users(id),
  purchased INTEGER DEFAULT 0,
  purchased_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);