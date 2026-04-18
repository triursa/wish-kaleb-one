import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
}

interface Item {
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
  user_name: string | null;
  user_email: string | null;
}

// ─── Theme ──────────────────────────────────────────────────────────────────

const theme = {
  bg: '#0a0a1a',
  glass: 'rgba(255,255,255,0.05)',
  glassHover: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.1)',
  accent: '#c084fc',
  accentHover: '#d8b4fe',
  accentGlow: 'rgba(192,132,252,0.3)',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  danger: '#f87171',
  success: '#4ade80',
};

const globalStyles: React.CSSProperties = {
  margin: 0,
  padding: 0,
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${theme.bg} 0%, #1a0a2e 50%, ${theme.bg} 100%)`,
  color: theme.text,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [urlInput, setUrlInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Cloudflare Access gates the site — if we can hit /api/auth/me, we're in
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        setUser(u);
        setLoading(false);
        if (u) fetchItems();
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/items', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {}
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: urlInput.trim(), notes: notesInput.trim() || undefined }),
      });
      if (res.ok) {
        setUrlInput('');
        setNotesInput('');
        await fetchItems();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add item');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePurchased = async (item: Item) => {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ purchased: !item.purchased }),
      });
      if (res.ok) await fetchItems();
    } catch {}
  };

  const handleDelete = async (item: Item) => {
    if (!confirm('Remove this item from the wishlist?')) return;
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) await fetchItems();
    } catch {}
  };

  const purchasedCount = items.filter(i => i.purchased).length;
  const pendingCount = items.length - purchasedCount;

  // ─── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...globalStyles, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: theme.accent, fontSize: '1.25rem' }}>Loading…</div>
      </div>
    );
  }

  // ─── Auth ──────────────────────────────────────────────────────────────

  // If no user identity, Access should have caught them — but just in case
  if (!user) {
    return (
      <div style={{ ...globalStyles, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
        <div style={{
          position: 'fixed', top: '-20%', left: '-10%', width: '50vw', height: '50vw',
          background: `radial-gradient(circle, ${theme.accentGlow}, transparent 70%)`,
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁</div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '2.5rem',
            fontWeight: 400,
            background: `linear-gradient(135deg, ${theme.accent}, #f0abfc)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            wish.kaleb.one
          </h1>
          <p style={{ color: theme.textDim, margin: '0.5rem 0 2rem' }}>
            Authenticating via Cloudflare Access…
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: '0.75rem 1.5rem',
            background: theme.glass,
            border: `1px solid ${theme.glassBorder}`,
            borderRadius: '0.75rem',
            color: theme.text,
            fontSize: '1rem',
            cursor: 'pointer',
            backdropFilter: 'blur(20px)',
          }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Wishlist View ──────────────────────────────────────────────

  return (
    <div style={globalStyles}>
      {/* Ambient background blobs */}
      <div style={{
        position: 'fixed', top: '-20%', left: '-10%', width: '50vw', height: '50vw',
        background: `radial-gradient(circle, ${theme.accentGlow}, transparent 70%)`,
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '-20%', right: '-10%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(96,165,250,0.15), transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '2rem',
              fontWeight: 400,
              background: `linear-gradient(135deg, ${theme.accent}, #f0abfc)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
            }}>
              wish.kaleb.one
            </h1>
            <p style={{ color: theme.textDim, fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              {pendingCount} pending · {purchasedCount} purchased
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: theme.textDim, fontSize: '0.875rem' }}>{user.name}</span>
          </div>
        </div>

        {/* Add Item Form */}
        <form onSubmit={handleAdd} style={{
          background: theme.glass,
          border: `1px solid ${theme.glassBorder}`,
          borderRadius: '1rem',
          padding: '1.25rem',
          marginBottom: '2rem',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', color: theme.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Product URL
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://www.etsy.com/listing/..."
              required
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: '0.5rem',
                padding: '0.65rem 0.85rem',
                color: theme.text,
                fontSize: '0.95rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', color: theme.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              placeholder="Size, color, variant..."
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: '0.5rem',
                padding: '0.65rem 0.85rem',
                color: theme.text,
                fontSize: '0.95rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: `linear-gradient(135deg, ${theme.accent}, #a855f7)`,
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.65rem 1.5rem',
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </form>

        {error && (
          <div style={{
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            color: theme.danger,
            marginBottom: '1rem',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* Items Grid */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: theme.textDim }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', margin: 0 }}>
              Nothing here yet — paste a URL above!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}>
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onTogglePurchased={() => handleTogglePurchased(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Item Card ───────────────────────────────────────────────────────────────

function ItemCard({ item, onTogglePurchased, onDelete }: {
  item: Item;
  onTogglePurchased: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const isPurchased = !!item.purchased;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: theme.glass,
        border: `1px solid ${theme.glassBorder}`,
        borderRadius: '1rem',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 8px 32px ${theme.accentGlow}` : '0 2px 8px rgba(0,0,0,0.3)',
        opacity: isPurchased ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Image */}
      {item.image_url ? (
        <div style={{
          width: '100%',
          height: '200px',
          background: 'rgba(255,255,255,0.03)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={item.image_url}
            alt={item.title}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '0.75rem' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      ) : (
        <div style={{
          width: '100%',
          height: '120px',
          background: `linear-gradient(135deg, rgba(192,132,252,0.1), rgba(96,165,250,0.1))`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
        }}>
          🎁
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <h3 style={{
          fontFamily: 'Georgia, serif',
          fontSize: '1.1rem',
          fontWeight: 400,
          margin: 0,
          textDecoration: isPurchased ? 'line-through' : 'none',
          color: isPurchased ? theme.textDim : theme.text,
          lineHeight: 1.3,
        }}>
          {item.title}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {item.price && (
            <span style={{
              background: `linear-gradient(135deg, ${theme.accent}, #a855f7)`,
              color: '#fff',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}>
              ${item.price}
            </span>
          )}
          {item.store_name && (
            <span style={{
              background: 'rgba(255,255,255,0.07)',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              color: theme.textDim,
            }}>
              {item.store_name}
            </span>
          )}
          {isPurchased && (
            <span style={{
              background: 'rgba(74,222,128,0.15)',
              color: theme.success,
              padding: '0.2rem 0.6rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
            }}>
              ✅ Purchased
            </span>
          )}
        </div>

        {item.notes && (
          <p style={{
            color: theme.textDim,
            fontSize: '0.85rem',
            margin: 0,
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {item.notes}
          </p>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: theme.accent,
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Buy at {item.store_name || 'Store'} →
          </a>
          <span style={{ flex: 1 }} />
          <button onClick={onTogglePurchased} style={{
            background: 'transparent',
            border: `1px solid ${isPurchased ? 'rgba(74,222,128,0.3)' : theme.glassBorder}`,
            color: isPurchased ? theme.success : theme.textDim,
            padding: '0.25rem 0.6rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}>
            {isPurchased ? 'Undo' : '✓ Got it'}
          </button>
          <button onClick={onDelete} style={{
            background: 'transparent',
            border: '1px solid rgba(248,113,113,0.3)',
            color: theme.danger,
            padding: '0.25rem 0.6rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
            opacity: 0.7,
          }}>
            ✕
          </button>
        </div>

        {item.user_name && (
          <div style={{ fontSize: '0.7rem', color: theme.textDim, marginTop: '0.25rem' }}>
            Added by {item.user_name} · {new Date(item.created_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}