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

interface ItemRow {
  id: string;
  url: string;
  title: string;
  price: string | null;
  image_url: string | null;
  store_name: string | null;
  notes: string | null;
  added_by: string;
  purchased: number;
  purchased_at: string | null;
  created_at: string;
  deleted_at: string | null;
  user_name: string | null;
  user_email: string | null;
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors({
  origin: '*',
  credentials: true,
}));

// ─── D1 Schema Initialization ────────────────────────────────────────────────

async function initDB(db: D1Database) {
  await db.exec(`
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
  `);
}

// ─── Cloudflare Access JWT Decoder ────────────────────────────────────────────
// Cloudflare Access sets Cf-Access-Jwt-Assertion header on every request that
// passes through the Access gate. It's a JWT signed by Cloudflare's key.
// We decode it (without full signature verification — the Access gate already
// guaranteed authenticity) to extract the user's email and identity.

function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

// ─── Auth Middleware (Cloudflare Access) ──────────────────────────────────────

const authMiddleware = async (c: any, next: any) => {
  // Cloudflare Access identity arrives via:
  // 1. Cf-Access-Jwt-Assertion header (set by Access on proxied requests)
  // 2. CF_Authorization cookie (set by Access login on the browser)
  // 3. JWT claim in Cf-Access-Jwt-Assertion contains the email
  // Try header first, then cookie
  let accessJwt = c.req.header('Cf-Access-Jwt-Assertion');
  if (!accessJwt) {
    // Read from cookie — name varies (CF_Authorization or cf_authorization)
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
    return c.json({ error: 'Email not allowed' }, 403);
  }

  await initDB(c.env.DB);

  // Upsert user from Access identity
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, NULL)
     ON CONFLICT(email) DO UPDATE SET name = ?`
  ).bind(crypto.randomUUID(), email, name, name).run();

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();

  c.set('user', { id: user!.id, email: user!.email, name: user!.name });
  await next();
};

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'wish.kaleb.one', auth: 'cloudflare-access' }));

// ─── Debug: show what auth headers/cookies arrive ─────────────────────────────

app.get('/api/auth/debug', (c) => {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.raw.headers)) {
    if (k.toLowerCase().startsWith('cf-') || k.toLowerCase() === 'cookie' || k.toLowerCase() === 'authorization') {
      // Truncate cookie values for security
      if (k.toLowerCase() === 'cookie') {
        headers[k] = v.replace(/=(eyJ[^;]{10})[^;]+/g, '=$1...(truncated)');
      } else {
        headers[k] = v;
      }
    }
  }
  return c.json({
    cfAccessJwtAssertion: c.req.header('Cf-Access-Jwt-Assertion') ? 'present' : 'missing',
    cookieHeader: c.req.header('Cookie') ? 'present' : 'missing',
    cfAuthCookie: (c.req.header('Cookie') || '').match(/CF_Authorization=([^;]+)/) ? 'present' : 'missing',
    allRelevantHeaders: headers,
    envAllowedEmails: c.env.ALLOWED_EMAILS || 'not set',
  });
});

// ─── Auth Routes (simplified — Access handles auth) ──────────────────────────

app.get('/api/auth/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json({ id: user.id, email: user.email, name: user.name });
});

// ─── Items Routes ────────────────────────────────────────────────────────────

app.get('/api/items', authMiddleware, async (c) => {
  await initDB(c.env.DB);
  const items = await c.env.DB.prepare(`
    SELECT i.*, u.name as user_name, u.email as user_email
    FROM items i
    JOIN users u ON i.added_by = u.id
    WHERE i.deleted_at IS NULL
    ORDER BY i.created_at DESC
  `).all<ItemRow>();
  return c.json(items.results);
});

app.post('/api/items', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { url, notes } = body;

  if (!url) return c.json({ error: 'URL is required' }, 400);
  await initDB(c.env.DB);

  const meta = await scrapeUrl(url);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO items (id, url, title, price, image_url, store_name, notes, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, url, meta.title || url, meta.price || null, meta.image || null,
    meta.store || null, notes || null, user.id
  ).run();

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();

  // Fire-and-forget GitHub sync
  syncToGitHub(c.env).catch(() => {});

  return c.json(item, 201);
});

app.patch('/api/items/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  await initDB(c.env.DB);

  const updates: string[] = [];
  const values: any[] = [];

  if (body.purchased !== undefined) {
    updates.push('purchased = ?');
    values.push(body.purchased ? 1 : 0);
    if (body.purchased) {
      updates.push("purchased_at = datetime('now')");
    } else {
      updates.push('purchased_at = NULL');
    }
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?');
    values.push(body.notes);
  }

  if (updates.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  syncToGitHub(c.env).catch(() => {});

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
  return c.json(item);
});

app.delete('/api/items/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await initDB(c.env.DB);
  await c.env.DB.prepare("UPDATE items SET deleted_at = datetime('now') WHERE id = ?").bind(id).run();
  syncToGitHub(c.env).catch(() => {});
  return c.json({ ok: true });
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

    // og: tags (either order of property/content)
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

    // Fallback to <title>
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

    // Make relative image URLs absolute
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, url).href;
      } catch {}
    }

    // Fallback: derive store from hostname
    if (!store) {
      try { store = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    }

    // Clean up store names
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

// ─── GitHub Vault Sync ────────────────────────────────────────────────────────

async function syncToGitHub(env: Env): Promise<void> {
  const items = await env.DB.prepare(`
    SELECT i.*, u.name as user_name
    FROM items i
    JOIN users u ON i.added_by = u.id
    WHERE i.deleted_at IS NULL
    ORDER BY i.created_at DESC
  `).all<ItemRow>();

  let markdown = '# Wishlist\n\n';
  markdown += '| Status | Item | Price | Store | Notes | Added |\n';
  markdown += '|--------|------|-------|-------|-------|-------|\n';

  for (const item of items.results) {
    const status = item.purchased ? '✅' : '🎁';
    const priceStr = item.price ? `$${item.price}` : '—';
    const titleLink = `[${item.title}](${item.url})`;
    const notes = item.notes || '—';
    const date = new Date(item.created_at).toLocaleDateString();
    markdown += `| ${status} | ${titleLink} | ${priceStr} | ${item.store_name || '—'} | ${notes} | ${date} |\n`;
  }

  const repo = env.GITHUB_VAULT_REPO;
  const path = env.GITHUB_VAULT_PATH;
  const branch = env.GITHUB_VAULT_BRANCH;
  const token = env.GITHUB_VAULT_TOKEN;

  if (!token || !repo) return;

  let sha: string | null = null;
  try {
    const fileRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
      { headers: { Authorization: `token ${token}`, 'User-Agent': 'wish-kaleb-one' } }
    );
    if (fileRes.ok) {
      const fileData = await fileRes.json() as any;
      sha = fileData.sha;
    }
  } catch {}

  const body: Record<string, string> = {
    message: 'wishlist: auto-sync from wish.kaleb.one',
    content: btoa(unescape(encodeURIComponent(markdown))),
    branch,
  };
  if (sha) body.sha = sha;

  await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'wish-kaleb-one',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// ─── Export for Cloudflare Pages Functions ─────────────────────────────────────

export const onRequest = handle(app);