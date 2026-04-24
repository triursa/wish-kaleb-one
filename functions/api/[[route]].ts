import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/cloudflare-pages';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
  ALLOWED_EMAILS: string;
  GITHUB_VAULT_TOKEN: string;
  GITHUB_VAULT_REPO: string;
  GITHUB_VAULT_PATH: string;
  GITHUB_VAULT_BRANCH: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  created_at: string;
}

interface ListRow {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  emoji: string;
  accent: string;
  created_at: string;
}

interface ItemRow {
  id: string;
  list_id: string;
  url: string;
  title: string;
  price: string | null;
  image_url: string | null;
  store_name: string | null;
  notes: string | null;
  added_by: string;
  priority: number;
  claimed_by: string | null;
  claimed_at: string | null;
  purchased: number;
  purchased_at: string | null;
  created_at: string;
  deleted_at: string | null;
  user_name: string | null;
  user_email: string | null;
  list_name: string | null;
  list_slug: string | null;
  list_emoji: string | null;
  list_accent: string | null;
  occasion_id: string | null;
  tag_names: string | null;
  tag_ids: string | null;
}

interface TagRow {
  id: string;
  name: string;
}

interface OccasionRow {
  id: string;
  list_id: string;
  name: string;
  date: string;
  emoji: string;
  created_at: string;
}

interface PriceSnapshotRow {
  id: string;
  item_id: string;
  price: string;
  scraped_at: string;
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors({
  origin: '*',
  credentials: true,
}));

// ─── D1 Schema Initialization ────────────────────────────────────────────────

const DEFAULT_TAGS = [
  'Jewelry', 'Clothing', 'Home', 'Tech', 'Experiences', 'Books', 'Other', 'Toys'
];

async function initDB(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      emoji TEXT DEFAULT '🎁',
      accent TEXT DEFAULT '#c084fc',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
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
      deleted_at TEXT
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT NOT NULL REFERENCES items(id),
      tag_id TEXT NOT NULL REFERENCES tags(id),
      PRIMARY KEY (item_id, tag_id)
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id),
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES users(id),
      item_id TEXT REFERENCES items(id),
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS occasions (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id),
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      emoji TEXT DEFAULT '🎉',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      price TEXT NOT NULL,
      scraped_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Ensure occasion_id column exists on items (additive migration)
  try {
    await db.prepare(`ALTER TABLE items ADD COLUMN occasion_id TEXT REFERENCES occasions(id)`).run();
  } catch {}

  // Seed default tags
  for (const tagName of DEFAULT_TAGS) {
    await db.prepare(`INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)`).bind(crypto.randomUUID(), tagName).run();
  }
}

// ─── Cloudflare Access JWT Decoder ────────────────────────────────────────────

function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4 !== 0) payload += '=';
    const decoded = atob(payload);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    const text = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Auth Middleware (Cloudflare Access) ──────────────────────────────────────

const authMiddleware = async (c: any, next: any) => {
  try {
    let accessJwt = c.req.header('Cf-Access-Jwt-Assertion');
    if (!accessJwt) {
      const cookieHeader = c.req.header('Cookie') || '';
      const match = cookieHeader.match(/(?:CF_Authorization|cf_authorization)=([^;]+)/);
      if (match) accessJwt = match[1];
    }

    if (!accessJwt) {
      return c.json({ error: 'Unauthorized — Cloudflare Access required' }, 401);
    }

    const claims = decodeJWT(accessJwt);
    if (!claims?.email) {
      return c.json({ error: 'Invalid Access token' }, 401);
    }

    const email = claims.email as string;
    const name = (claims.name as string) || email.split('@')[0];

    const allowedEmails = (c.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
      return c.json({ error: 'Email not allowed', email }, 403);
    }

    await initDB(c.env.DB);

    // Upsert user
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, NULL)
       ON CONFLICT(email) DO UPDATE SET name = ?`
    ).bind(crypto.randomUUID(), email, name, name).run();

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();

    // Ensure default lists exist
    await ensureDefaultLists(c.env.DB, user!.id);

    c.set('user', { id: user!.id, email: user!.email, name: user!.name });
    await next();
  } catch (err: any) {
    return c.json({ error: 'Auth middleware error', message: err?.message || String(err) }, 500);
  }
};

// ─── Default Lists ──────────────────────────────────────────────────────────

const DEFAULT_LISTS = [
  { name: 'Kaleb List', slug: 'kaleb', emoji: '🐻', accent: '#f59e0b', ownerEmail: 'kaleb.bays@gmail.com' },
  { name: 'Mindy List', slug: 'mindy', emoji: '🌸', accent: '#ec4899', ownerEmail: 'melindajean16@gmail.com' },
  { name: 'Teddy List', slug: 'teddy', emoji: '🧸', accent: '#3b82f6', ownerEmail: null }, // shared
];

async function ensureDefaultLists(db: D1Database, _userId: string) {
  for ( const list of DEFAULT_LISTS) {
    const existing = await db.prepare('SELECT id FROM lists WHERE slug = ?').bind(list.slug).first();
    if (!existing) {
      const id = crypto.randomUUID();
      // For shared lists (ownerEmail null), set owner_id to null
      let ownerId: string | null = null;
      if (list.ownerEmail) {
        const owner = await db.prepare('SELECT id FROM users WHERE email = ?').bind(list.ownerEmail).first<UserRow>();
        if (owner) ownerId = owner.id;
      }
      await db.prepare(
        'INSERT INTO lists (id, owner_id, name, slug, emoji, accent) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, ownerId, list.name, list.slug, list.emoji, list.accent).run();
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logActivity(db: D1Database, listId: string, action: string, actorId: string, itemId: string | null, metadata?: Record<string, any>) {
  await db.prepare(
    'INSERT INTO activity (id, list_id, action, actor_id, item_id, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), listId, action, actorId, itemId, metadata ? JSON.stringify(metadata) : null).run();
}

function hideClaimerForOwner(item: any, user: any, list: ListRow | null) {
  if (!item) return item;
  if (!list) return item;
  const isOwner = list.owner_id === user.id;
  const isSharedList = list.owner_id === null;
  if ((isOwner || isSharedList) && item.claimed_by && item.claimed_by !== user.id) {
    return { ...item, claimed_by: 'hidden', claimed_at: item.claimed_at };
  }
  return item;
}

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'wish.kaleb.one', version: '2.1', auth: 'cloudflare-access' }));

// ─── Auth Routes ─────────────────────────────────────────────────────────────

app.get('/api/auth/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json({ id: user.id, email: user.email, name: user.name });
});

app.get('/api/auth/debug', (c) => {
  const header = c.req.header('Cf-Access-Jwt-Assertion');
  const cookieHeader = c.req.header('Cookie') || '';
  const cookieMatch = cookieHeader.match(/(?:CF_Authorization|cf_authorization)=([^;]+)/);
  return c.json({
    hasHeader: !!header,
    headerLength: header?.length || 0,
    hasCookie: !!cookieMatch,
    cookieLength: cookieMatch?.[1]?.length || 0,
  });
});

// ─── Lists Routes ────────────────────────────────────────────────────────────

app.get('/api/lists', authMiddleware, async (c) => {
  const db = c.env.DB;
  await initDB(db);
  const lists = await db.prepare('SELECT * FROM lists ORDER BY created_at ASC').all<ListRow>();
  return c.json(lists.results);
});

app.get('/api/lists/:slug', authMiddleware, async (c) => {
  const slug = c.req.param('slug');
  await initDB(c.env.DB);
  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE slug = ?').bind(slug).first<ListRow>();
  if (!list) return c.json({ error: 'List not found' }, 404);
  return c.json(list);
});

// ─── Tags Routes ─────────────────────────────────────────────────────────────

app.get('/api/tags', authMiddleware, async (c) => {
  await initDB(c.env.DB);
  const tags = await c.env.DB.prepare('SELECT * FROM tags ORDER BY name ASC').all<TagRow>();
  return c.json(tags.results);
});

app.post('/api/items/:id/tags', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const { tag_id } = body;
  if (!tag_id) return c.json({ error: 'tag_id required' }, 400);
  await initDB(c.env.DB);

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<ItemRow>();
  if (!item || item.deleted_at) return c.json({ error: 'Item not found' }, 404);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(item.list_id).first<ListRow>();
  const isOwner = list?.owner_id === user.id;
  const isShared = list?.owner_id === null;
  if (!isOwner && !isShared && item.added_by !== user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  await c.env.DB.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').bind(id, tag_id).run();
  return c.json({ ok: true });
});

app.delete('/api/items/:id/tags/:tagId', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const tagId = c.req.param('tagId');
  await initDB(c.env.DB);

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<ItemRow>();
  if (!item || item.deleted_at) return c.json({ error: 'Item not found' }, 404);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(item.list_id).first<ListRow>();
  const isOwner = list?.owner_id === user.id;
  const isShared = list?.owner_id === null;
  if (!isOwner && !isShared && item.added_by !== user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').bind(id, tagId).run();
  return c.json({ ok: true });
});

// ─── Occasions Routes ──────────────────────────────────────────────────────────

app.get('/api/lists/:listId/occasions', authMiddleware, async (c) => {
  const listId = c.req.param('listId');
  await initDB(c.env.DB);
  const occasions = await c.env.DB.prepare('SELECT * FROM occasions WHERE list_id = ? ORDER BY date ASC').bind(listId).all<OccasionRow>();
  return c.json(occasions.results);
});

app.post('/api/lists/:listId/occasions', authMiddleware, async (c) => {
  const user = c.get('user');
  const listId = c.req.param('listId');
  const body = await c.req.json();
  const { name, date, emoji } = body;
  if (!name || !date) return c.json({ error: 'name and date required' }, 400);
  await initDB(c.env.DB);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(listId).first<ListRow>();
  if (!list) return c.json({ error: 'List not found' }, 404);
  const isOwner = list.owner_id === user.id;
  const isShared = list.owner_id === null;
  if (!isOwner && !isShared) return c.json({ error: 'Not authorized' }, 403);

  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO occasions (id, list_id, name, date, emoji) VALUES (?, ?, ?, ?, ?)')
    .bind(id, listId, name, date, emoji || '🎉').run();
  await logActivity(c.env.DB, listId, 'occasion_created', user.id, null, { name, date });
  syncToGitHub(c.env).catch(() => {});

  const occasion = await c.env.DB.prepare('SELECT * FROM occasions WHERE id = ?').bind(id).first<OccasionRow>();
  return c.json(occasion, 201);
});

app.delete('/api/occasions/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await initDB(c.env.DB);

  const occasion = await c.env.DB.prepare('SELECT * FROM occasions WHERE id = ?').bind(id).first<OccasionRow>();
  if (!occasion) return c.json({ error: 'Occasion not found' }, 404);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(occasion.list_id).first<ListRow>();
  const isOwner = list?.owner_id === user.id;
  const isShared = list?.owner_id === null;
  if (!isOwner && !isShared) return c.json({ error: 'Not authorized' }, 403);

  await c.env.DB.prepare('DELETE FROM occasions WHERE id = ?').bind(id).run();
  await c.env.DB.prepare('UPDATE items SET occasion_id = NULL WHERE occasion_id = ?').bind(id).run();
  await logActivity(c.env.DB, occasion.list_id, 'occasion_deleted', user.id, null, { name: occasion.name });
  syncToGitHub(c.env).catch(() => {});

  return c.json({ ok: true });
});

// ─── Price History Routes ─────────────────────────────────────────────────────

app.get('/api/items/:id/prices', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await initDB(c.env.DB);
  const snapshots = await c.env.DB.prepare('SELECT * FROM price_snapshots WHERE item_id = ? ORDER BY scraped_at ASC').bind(id).all<PriceSnapshotRow>();
  return c.json(snapshots.results);
});

app.post('/api/items/:id/rescrape', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await initDB(c.env.DB);

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<ItemRow>();
  if (!item || item.deleted_at) return c.json({ error: 'Item not found' }, 404);

  const meta = await scrapeUrl(item.url);
  if (!meta.price) return c.json({ error: 'Could not scrape price' }, 400);

  const lastSnapshot = await c.env.DB.prepare('SELECT * FROM price_snapshots WHERE item_id = ? ORDER BY scraped_at DESC LIMIT 1').bind(id).first<PriceSnapshotRow>();

  let saved = false;
  if (!lastSnapshot || lastSnapshot.price !== meta.price) {
    await c.env.DB.prepare('INSERT INTO price_snapshots (id, item_id, price) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), id, meta.price).run();
    saved = true;
    if (item.price !== meta.price) {
      await c.env.DB.prepare('UPDATE items SET price = ? WHERE id = ?').bind(meta.price, id).run();
    }
  }

  return c.json({ ok: true, price: meta.price, saved, previous: lastSnapshot?.price || null });
});

// ─── Items Routes ────────────────────────────────────────────────────────────

async function attachTags(db: D1Database, items: any[]) {
  if (items.length === 0) return items;
  const itemIds = items.map(i => i.id);
  // D1 doesn't support IN with variable list easily; batch into chunks of 50 via OR
  const tagRows = await db.prepare(`
    SELECT it.item_id, t.id as tag_id, t.name as tag_name
    FROM item_tags it
    JOIN tags t ON it.tag_id = t.id
    WHERE it.item_id IN (${itemIds.map(() => '?').join(',')})
  `).bind(...itemIds).all();

  const tagMap: Record<string, { id: string; name: string }[]> = {};
  for (const row of tagRows.results as any[]) {
    if (!tagMap[row.item_id]) tagMap[row.item_id] = [];
    tagMap[row.item_id].push({ id: row.tag_id, name: row.tag_name });
  }

  return items.map(item => ({
    ...item,
    tags: tagMap[item.id] || [],
  }));
}

// GET /api/lists/:listId/items — items for a specific list
app.get('/api/lists/:listId/items', authMiddleware, async (c) => {
  const user = c.get('user');
  const listId = c.req.param('listId');
  await initDB(c.env.DB);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(listId).first<ListRow>();
  if (!list) return c.json({ error: 'List not found' }, 404);

  const items = await c.env.DB.prepare(`
    SELECT i.*, u.name as user_name, u.email as user_email,
           l.name as list_name, l.slug as list_slug, l.emoji as list_emoji, l.accent as list_accent
    FROM items i
    JOIN users u ON i.added_by = u.id
    JOIN lists l ON i.list_id = l.id
    WHERE i.list_id = ? AND i.deleted_at IS NULL
    ORDER BY i.priority DESC, i.created_at DESC
  `).bind(listId).all<ItemRow>();

  // Hide claimed_by from list owners (surprise preservation)
  const isOwner = list.owner_id === user.id;
  const isSharedList = list.owner_id === null;
  let results = items.results.map(item => {
    if ((isOwner || isSharedList) && item.claimed_by && item.claimed_by !== user.id) {
      return { ...item, claimed_by: 'hidden', claimed_at: item.claimed_at };
    }
    return item;
  });

  results = await attachTags(c.env.DB, results);

  return c.json(results);
});

// GET /api/items — all items across all lists (for "My Claims" view)
app.get('/api/items', authMiddleware, async (c) => {
  const user = c.get('user');
  await initDB(c.env.DB);

  const items = await c.env.DB.prepare(`
    SELECT i.*, u.name as user_name, u.email as user_email,
           l.name as list_name, l.slug as list_slug, l.emoji as list_emoji, l.accent as list_accent
    FROM items i
    JOIN users u ON i.added_by = u.id
    JOIN lists l ON i.list_id = l.id
    WHERE i.deleted_at IS NULL
    ORDER BY i.priority DESC, i.created_at DESC
  `).all<ItemRow>();

  // For each item, hide claimed_by if the viewer is the list owner and didn't claim it themselves
  const allLists = await c.env.DB.prepare('SELECT * FROM lists').all<ListRow>();
  const listOwnerMap: Record<string, string | null> = {};
  for (const l of allLists.results) listOwnerMap[l.id] = l.owner_id;

  let results = items.results.map(item => {
    const listOwnerId = listOwnerMap[item.list_id];
    const isOwner = listOwnerId === user.id;
    const isSharedList = listOwnerId === null;
    if ((isOwner || isSharedList) && item.claimed_by && item.claimed_by !== user.id) {
      return { ...item, claimed_by: 'hidden', claimed_at: item.claimed_at };
    }
    return item;
  });

  results = await attachTags(c.env.DB, results);

  return c.json(results);
});

// POST /api/lists/:listId/items — add item to a specific list
app.post('/api/lists/:listId/items', authMiddleware, async (c) => {
  const user = c.get('user');
  const listId = c.req.param('listId');
  const body = await c.req.json();
  const { url, notes, priority, title, price, image_url, store_name, tag_ids, occasion_id } = body;

  if (!url) return c.json({ error: 'URL is required' }, 400);
  await initDB(c.env.DB);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(listId).first<ListRow>();
  if (!list) return c.json({ error: 'List not found' }, 404);

  // Check permissions: owner can add to their list, anyone can add to shared lists
  const isOwner = list.owner_id === user.id;
  const isShared = list.owner_id === null;
  if (!isOwner && !isShared) {
    return c.json({ error: 'Only the list owner can add items' }, 403);
  }

  const isManual = !!(title || price || image_url || store_name);

  let meta: { title: string | null; price: string | null; image: string | null; store: string | null };
  if (isManual) {
    meta = {
      title: title || null,
      price: price || null,
      image: image_url || null,
      store: store_name || null,
    };
  } else {
    meta = await scrapeUrl(url);
  }

  // If scraper returns null title, fallback to URL as title
  const finalTitle = meta.title || url;

  const itemPriority = priority || 0;
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO items (id, list_id, url, title, price, image_url, store_name, notes, added_by, priority, occasion_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, listId, url, finalTitle, meta.price || null, meta.image || null,
    meta.store || null, notes || null, user.id, itemPriority, occasion_id || null
  ).run();

  // Attach tags
  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    for (const tagId of tag_ids) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').bind(id, tagId).run();
    }
  }

  // Save initial price snapshot
  if (meta.price) {
    await c.env.DB.prepare('INSERT INTO price_snapshots (id, item_id, price) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), id, meta.price).run();
  }

  await logActivity(c.env.DB, listId, 'added', user.id, id);
  syncToGitHub(c.env).catch(() => {});

  let item = await c.env.DB.prepare(`
    SELECT i.*, u.name as user_name, u.email as user_email,
           l.name as list_name, l.slug as list_slug, l.emoji as list_emoji, l.accent as list_accent
    FROM items i
    JOIN users u ON i.added_by = u.id
    JOIN lists l ON i.list_id = l.id
    WHERE i.id = ?
  `).bind(id).first();

  [item] = await attachTags(c.env.DB, [item]);
  return c.json(item, 201);
});

// PATCH /api/items/:id — update item (claim, unclaim, mark purchased, priority)
app.patch('/api/items/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  await initDB(c.env.DB);

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<ItemRow>();
  if (!item || item.deleted_at) return c.json({ error: 'Item not found' }, 404);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(item.list_id).first<ListRow>();
  const isOwner = list?.owner_id === user.id;
  const isShared = list?.owner_id === null;

  const updates: string[] = [];
  const values: any[] = [];

  // Claiming: only non-owners can claim on personal lists; anyone can claim on shared lists (except owner)
  if (body.claim !== undefined) {
    if (body.claim === true) {
      // Can't claim your own items on a personal list
      if (isOwner && !isShared) {
        return c.json({ error: 'You cannot claim items on your own list' }, 403);
      }
      if (item.claimed_by) {
        return c.json({ error: 'Already claimed' }, 409);
      }
      updates.push('claimed_by = ?', 'claimed_at = datetime(\'now\')');
      values.push(user.id);
      await logActivity(c.env.DB, item.list_id, 'claimed', user.id, id);
    } else if (body.claim === false) {
      // Can only unclaim your own claim
      if (item.claimed_by !== user.id) {
        return c.json({ error: 'You can only unclaim your own claims' }, 403);
      }
      updates.push('claimed_by = NULL', 'claimed_at = NULL');
      await logActivity(c.env.DB, item.list_id, 'unclaimed', user.id, id);
    }
  }

  // Purchased/received: only the list owner or shared list manager can mark
  if (body.purchased !== undefined) {
    if (!isOwner && !isShared) {
      return c.json({ error: 'Only the list owner can mark items as purchased' }, 403);
    }
    updates.push('purchased = ?');
    values.push(body.purchased ? 1 : 0);
    if (body.purchased) {
      updates.push("purchased_at = datetime('now')");
    } else {
      updates.push('purchased_at = NULL');
    }
    await logActivity(c.env.DB, item.list_id, body.purchased ? 'purchased' : 'unpurchased', user.id, id);
  }

  // Notes: anyone can edit notes
  if (body.notes !== undefined) {
    updates.push('notes = ?');
    values.push(body.notes);
  }

  // Priority: only list owner can set priority
  if (body.priority !== undefined) {
    if (!isOwner && !isShared) {
      return c.json({ error: 'Only the list owner can set priority' }, 403);
    }
    updates.push('priority = ?');
    values.push(body.priority);
    await logActivity(c.env.DB, item.list_id, 'priority_changed', user.id, id, { priority: body.priority });
  }

  // Occasion
  if (body.occasion_id !== undefined) {
    if (!isOwner && !isShared && item.added_by !== user.id) {
      return c.json({ error: 'Not authorized' }, 403);
    }
    updates.push('occasion_id = ?');
    values.push(body.occasion_id || null);
  }

  if (updates.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  syncToGitHub(c.env).catch(() => {});

  let updated = await c.env.DB.prepare(`
    SELECT i.*, u.name as user_name, u.email as user_email,
           l.name as list_name, l.slug as list_slug, l.emoji as list_emoji, l.accent as list_accent
    FROM items i
    JOIN users u ON i.added_by = u.id
    JOIN lists l ON i.list_id = l.id
    WHERE i.id = ?
  `).bind(id).first();

  // Hide claimed_by from list owner if not the claimer
  if ((isOwner || isShared) && updated?.claimed_by && updated.claimed_by !== user.id) {
    (updated as any).claimed_by = 'hidden';
  }

  [updated] = await attachTags(c.env.DB, [updated]);

  return c.json(updated);
});

// DELETE /api/items/:id — soft delete
app.delete('/api/items/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await initDB(c.env.DB);

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<ItemRow>();
  if (!item || item.deleted_at) return c.json({ error: 'Item not found' }, 404);

  const list = await c.env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(item.list_id).first<ListRow>();
  const isOwner = list?.owner_id === user.id;
  const isShared = list?.owner_id === null;

  // Only list owner or the person who added it can delete
  if (!isOwner && !isShared && item.added_by !== user.id) {
    return c.json({ error: 'Not authorized to delete this item' }, 403);
  }

  await c.env.DB.prepare("UPDATE items SET deleted_at = datetime('now') WHERE id = ?").bind(id).run();
  await logActivity(c.env.DB, item.list_id, 'deleted', user.id, id);
  syncToGitHub(c.env).catch(() => {});

  return c.json({ ok: true });
});

// ─── My Claims ──────────────────────────────────────────────────────────────

app.get('/api/my-claims', authMiddleware, async (c) => {
  const user = c.get('user');
  await initDB(c.env.DB);

  const items = await c.env.DB.prepare(`
    SELECT i.*, u.name as user_name, u.email as user_email,
           l.name as list_name, l.slug as list_slug, l.emoji as list_emoji, l.accent as list_accent
    FROM items i
    JOIN users u ON i.added_by = u.id
    JOIN lists l ON i.list_id = l.id
    WHERE i.claimed_by = ? AND i.deleted_at IS NULL AND i.purchased = 0
    ORDER BY i.created_at DESC
  `).bind(user.id).all<ItemRow>();

  let results = items.results;
  results = await attachTags(c.env.DB, results);
  return c.json(results);
});

// ─── Activity Route ─────────────────────────────────────────────────────────

app.get('/api/activity', authMiddleware, async (c) => {
  const user = c.get('user');
  await initDB(c.env.DB);

  const activity = await c.env.DB.prepare(`
    SELECT a.*, u.name as actor_name, u.email as actor_email,
           i.title as item_title, l.name as list_name, l.slug as list_slug, l.emoji as list_emoji
    FROM activity a
    JOIN users u ON a.actor_id = u.id
    LEFT JOIN items i ON a.item_id = i.id
    JOIN lists l ON a.list_id = l.id
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all();

  // For 'claimed' actions, hide actor identity from list owners
  const allLists = await c.env.DB.prepare('SELECT * FROM lists').all<ListRow>();
  const listOwnerMap: Record<string, string | null> = {};
  for (const l of allLists.results) listOwnerMap[l.id] = l.owner_id;

  const results = activity.results.map((a: any) => {
    const listOwnerId = listOwnerMap[a.list_id];
    const isOwner = listOwnerId === user.id;
    const isShared = listOwnerId === null;
    if ((isOwner || isShared) && a.action === 'claimed' && a.actor_id !== user.id) {
      return { ...a, actor_name: 'Someone', actor_email: 'hidden' };
    }
    return a;
  });

  return c.json(results);
});

// ─── Sync Route ──────────────────────────────────────────────────────────────

app.post('/api/sync', authMiddleware, async (c) => {
  await initDB(c.env.DB);
  try {
    await syncToGitHub(c.env);
    return c.json({ ok: true, message: 'Synced to GitHub vault' });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ─── Scrape Endpoint ───────────────────────────────────────────────────────────

app.post('/api/scrape', authMiddleware, async (c) => {
  const body = await c.req.json();
  const { url } = body;
  if (!url) return c.json({ error: 'URL required' }, 400);
  const meta = await scrapeUrl(url);
  return c.json(meta);
});

// ─── Scraper ──────────────────────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<{
  title: string | null;
  price: string | null;
  image: string | null;
  store: string | null;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await res.text();

    let title: string | null = null;
    let price: string | null = null;
    let image: string | null = null;
    let store: string | null = null;

    const ogTags: Record<string, string> = {};
    const ogRegex = /<meta[^>]+(?:property|name)=["']og:([^"']+)["'][^>]+(?:content|value)=["']([^"']+)["'][^>]*>/gi;
    const ogRegex2 = /<meta[^>]+(?:content|value)=["']([^"']+)["'][^>]+(?:property|name)=["']og:([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = ogRegex.exec(html)) !== null) ogTags[m[1]] = m[2];
    while ((m = ogRegex2.exec(html)) !== null) ogTags[m[2]] = m[1];

    title = ogTags['title'] || null;
    image = ogTags['image'] || null;
    price = ogTags['price:amount'] || null;
    store = ogTags['site_name'] || null;

    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch?.[1]?.trim() || null;
    }

    // Fallback: try JSON-LD for price
    if (!price) {
      const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of jsonLdMatches) {
        try {
          const ld = JSON.parse(match[1]);
          const offers = ld?.offers;
          if (offers?.price) { price = String(offers.price); break; }
          if (Array.isArray(offers)) {
            for (const o of offers) {
              if (o?.price) { price = String(o.price); break; }
            }
          }
          if (!title && ld?.name) title = ld.name;
          if (!image && ld?.image) {
            image = typeof ld.image === 'string' ? ld.image : (ld.image?.[0] || ld.image?.url || null);
          }
        } catch {}
      }
    }

    if (image && !image.startsWith('http')) {
      try { image = new URL(image, url).href; } catch {}
    }

    if (!store) {
      try { store = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    }

    const storeNames: Record<string, string> = {
      'etsy.com': 'Etsy',
      'amazon.com': 'Amazon',
      'freepeople.com': 'Free People',
      'adornmonde.com': 'Adorn',
      'madebymary.com': 'Made by Mary',
      'gldn.com': 'GLDN',
    };
    for (const [domain, name] of Object.entries(storeNames)) {
      if (store?.includes(domain)) { store = name; break; }
    }

    return { title, price, image, store };
  } catch {
    return { title: null, price: null, image: null, store: null };
  }
}

// ─── GitHub Vault Sync (Per-List) ────────────────────────────────────────────

async function syncToGitHub(env: Env): Promise<void> {
  const lists = await env.DB.prepare('SELECT * FROM lists ORDER BY created_at ASC').all<ListRow>();

  const repo = env.GITHUB_VAULT_REPO;
  const branch = env.GITHUB_VAULT_BRANCH;
  const token = env.GITHUB_VAULT_TOKEN;

  if (!token || !repo) return;

  for (const list of lists.results) {
    const items = await env.DB.prepare(`
      SELECT i.*, u.name as user_name, group_concat(t.name, ', ') as tag_names
      FROM items i
      JOIN users u ON i.added_by = u.id
      LEFT JOIN item_tags it ON i.id = it.item_id
      LEFT JOIN tags t ON it.tag_id = t.id
      WHERE i.list_id = ? AND i.deleted_at IS NULL
      GROUP BY i.id
      ORDER BY i.priority DESC, i.created_at DESC
    `).bind(list.id).all<ItemRow>();

    const fileName = `${list.slug.toUpperCase()}.md`;
    const filePath = 'domains/wishlist/' + fileName;

    let markdown = `# ${list.name}\n\n`;
    markdown += `> ${list.emoji} Auto-synced from [wish.kaleb.one](https://wish.kaleb.one)\n`;
    markdown += `> Last updated: ${new Date().toISOString().split('T')[0]}\n\n`;
    markdown += `| Status | Item | Price | Store | Tags | Notes | Priority | Added |\n`;
    markdown += `|--------|------|-------|-------|------|-------|----------|-------|\n`;

    for (const item of items.results) {
      const purchaseStatus = item.purchased ? '✅' : (item.claimed_by ? '🔐' : '🎁');
      const priceStr = item.price ? `$${item.price}` : '—';
      const titleLink = `[${item.title}](${item.url})`;
      const notes = item.notes || '—';
      const tags = item.tag_names || '—';
      const priorityLabel = item.priority === 2 ? '🔥' : item.priority === 1 ? '⬆️' : '—';
      const date = new Date(item.created_at).toLocaleDateString();
      markdown += `| ${purchaseStatus} | ${titleLink} | ${priceStr} | ${item.store_name || '—'} | ${tags} | ${notes} | ${priorityLabel} | ${date} |\n`;
    }

    // Get existing file SHA
    let sha: string | null = null;
    try {
      const fileRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`,
        { headers: { Authorization: `token ${token}`, 'User-Agent': 'wish-kaleb-one' } }
      );
      if (fileRes.ok) {
        const fileData = await fileRes.json() as any;
        sha = fileData.sha;
      }
    } catch {}

    const body: Record<string, string> = {
      message: `wishlist: sync ${list.name} from wish.kaleb.one`,
      content: btoa(unescape(encodeURIComponent(markdown))),
      branch,
    };
    if (sha) body.sha = sha;

    await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'wish-kaleb-one',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Space out API calls to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ─── Export for Cloudflare Pages Functions ─────────────────────────────────────

export const onRequest = handle(app);
