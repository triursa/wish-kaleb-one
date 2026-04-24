import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
}

interface WishList {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  emoji: string;
  accent: string;
  created_at: string;
}

interface Item {
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
}

interface ActivityItem {
  id: string;
  list_id: string;
  action: string;
  actor_id: string;
  item_id: string | null;
  metadata: string | null;
  created_at: string;
  actor_name: string;
  actor_email: string;
  item_title: string | null;
  list_name: string;
  list_slug: string;
  list_emoji: string;
}

// ─── Theme ──────────────────────────────────────────────────────────────────

const defaultTheme = {
  bg: '#0a0a1a',
  glass: 'rgba(255,255,255,0.05)',
  glassHover: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.1)',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  danger: '#f87171',
  success: '#4ade80',
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [lists, setLists] = useState<WishList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [myClaims, setMyClaims] = useState<Item[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lists' | 'claims' | 'activity'>('lists');

  // Form state
  const [urlInput, setUrlInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        setUser(u);
        setLoading(false);
        if (u) {
          fetchLists();
          fetchMyClaims();
          fetchActivity();
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/lists', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLists(data);
        if (data.length > 0 && !activeListId) {
          setActiveListId(data[0].id);
          fetchListItems(data[0].id);
        } else if (activeListId) {
          fetchListItems(activeListId);
        }
      }
    } catch {}
  }, []);

  const fetchListItems = useCallback(async (listId: string) => {
    try {
      const res = await fetch(`/api/lists/${listId}/items`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {}
  }, []);

  const fetchMyClaims = useCallback(async () => {
    try {
      const res = await fetch('/api/my-claims', { credentials: 'include' });
      if (res.ok) setMyClaims(await res.json());
    } catch {}
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity', { credentials: 'include' });
      if (res.ok) setActivity(await res.json());
    } catch {}
  }, []);

  const switchList = (listId: string) => {
    setActiveListId(listId);
    setItems([]);
    fetchListItems(listId);
  };

  const activeList = lists.find(l => l.id === activeListId);
  const isOwnerOfActiveList = activeList?.owner_id === user?.id;
  const isSharedList = activeList?.owner_id === null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || submitting || !activeListId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/lists/${activeListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: urlInput.trim(), notes: notesInput.trim() || undefined }),
      });
      if (res.ok) {
        setUrlInput('');
        setNotesInput('');
        await fetchListItems(activeListId);
        fetchMyClaims();
        fetchActivity();
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

  const handleClaim = async (item: Item) => {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ claim: !item.claimed_by }),
      });
      if (res.ok) {
        await fetchListItems(item.list_id);
        fetchMyClaims();
        fetchActivity();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed');
      }
    } catch {}
  };

  const handleTogglePurchased = async (item: Item) => {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ purchased: !item.purchased }),
      });
      if (res.ok) {
        await fetchListItems(item.list_id);
        fetchActivity();
      }
    } catch {}
  };

  const handleDelete = async (item: Item) => {
    if (!confirm('Remove this item?')) return;
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchListItems(item.list_id);
        fetchMyClaims();
        fetchActivity();
      }
    } catch {}
  };

  const handleSetPriority = async (item: Item, priority: number) => {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority }),
      });
      if (res.ok) {
        await fetchListItems(item.list_id);
      }
    } catch {}
  };

  const pendingCount = items.filter(i => !i.purchased && !i.claimed_by).length;
  const claimedCount = items.filter(i => i.claimed_by && !i.purchased).length;
  const purchasedCount = items.filter(i => i.purchased).length;

  // ─── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...globalStyles, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#c084fc', fontSize: '1.25rem' }}>Loading…</div>
      </div>
    );
  }

  // ─── Auth Gate ──────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{ ...globalStyles, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
        <div style={{
          position: 'fixed', top: '-20%', left: '-10%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(192,132,252,0.3), transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁</div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '2.5rem',
            fontWeight: 400,
            background: 'linear-gradient(135deg, #c084fc, #f0abfc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            wish.kaleb.one
          </h1>
          <p style={{ color: defaultTheme.textDim, margin: '0.5rem 0 2rem' }}>
            Authenticating via Cloudflare Access…
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: '0.75rem 1.5rem',
            background: defaultTheme.glass,
            border: `1px solid ${defaultTheme.glassBorder}`,
            borderRadius: '0.75rem',
            color: defaultTheme.text,
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

  // ─── Main View ──────────────────────────────────────────────────────

  const accent = activeList?.accent || '#c084fc';

  return (
    <div style={globalStyles}>
      {/* Ambient background */}
      <div style={{
        position: 'fixed', top: '-20%', left: '-10%', width: '50vw', height: '50vw',
        background: `radial-gradient(circle, ${accent}33, transparent 70%)`,
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, transition: 'background 0.5s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: '-20%', right: '-10%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(96,165,250,0.15), transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '2rem',
              fontWeight: 400,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              transition: 'all 0.3s ease',
            }}>
              wish.kaleb.one
            </h1>
            <p style={{ color: defaultTheme.textDim, fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              {user.name}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <NavButton
              active={view === 'lists'}
              onClick={() => setView('lists')}
              accent={accent}
            >
              📋 Lists
            </NavButton>
            <NavButton
              active={view === 'claims'}
              onClick={() => { setView('claims'); fetchMyClaims(); }}
              accent={accent}
              badge={myClaims.length}
            >
              🎯 My Claims
            </NavButton>
            <NavButton
              active={view === 'activity'}
              onClick={() => { setView('activity'); fetchActivity(); }}
              accent={accent}
            >
              📰 Activity
            </NavButton>
          </div>
        </div>

        {/* Lists View */}
        {view === 'lists' && (
          <>
            {/* List Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => switchList(list.id)}
                  style={{
                    background: activeListId === list.id ? `${list.accent}22` : defaultTheme.glass,
                    border: `1px solid ${activeListId === list.id ? `${list.accent}66` : defaultTheme.glassBorder}`,
                    borderRadius: '0.75rem',
                    padding: '0.6rem 1.2rem',
                    color: activeListId === list.id ? list.accent : defaultTheme.textDim,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: activeListId === list.id ? 600 : 400,
                    backdropFilter: 'blur(20px)',
                    transition: 'all 0.2s ease',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {list.emoji} {list.name}
                </button>
              ))}
            </div>

            {/* List Stats */}
            {activeList && (
              <p style={{ color: defaultTheme.textDim, fontSize: '0.85rem', margin: '0 0 1rem' }}>
                {pendingCount} available · {claimedCount} claimed · {purchasedCount} received
              </p>
            )}

            {/* Add Item Form — only for list owners or shared lists */}
            {activeListId && (isOwnerOfActiveList || isSharedList) && (
              <form onSubmit={handleAdd} style={{
                background: defaultTheme.glass,
                border: `1px solid ${defaultTheme.glassBorder}`,
                borderRadius: '1rem',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}>
                <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', color: defaultTheme.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Product URL
                  </label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://www.etsy.com/listing/..."
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', color: defaultTheme.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={e => setNotesInput(e.target.value)}
                    placeholder="Size, color, variant..."
                    style={inputStyle}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
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
            )}

            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                color: defaultTheme.danger,
                marginBottom: '1rem',
                fontSize: '0.9rem',
              }}>
                {error}
              </div>
            )}

            {/* Items Grid */}
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: defaultTheme.textDim }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{activeList?.emoji || '🎁'}</div>
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
                    user={user}
                    isOwner={isOwnerOfActiveList}
                    isSharedList={isSharedList}
                    accent={accent}
                    onClaim={() => handleClaim(item)}
                    onTogglePurchased={() => handleTogglePurchased(item)}
                    onDelete={() => handleDelete(item)}
                    onSetPriority={(p) => handleSetPriority(item, p)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* My Claims View */}
        {view === 'claims' && (
          <>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.5rem',
              fontWeight: 400,
              color: defaultTheme.text,
              margin: '0 0 1.5rem',
            }}>
              🎯 My Claims
            </h2>
            {myClaims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: defaultTheme.textDim }}>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', margin: 0 }}>
                  No claims yet — browse a list and grab something!
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.25rem',
              }}>
                {myClaims.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    user={user}
                    isOwner={false}
                    isSharedList={false}
                    accent={item.list_accent || '#c084fc'}
                    onClaim={() => { handleClaim(item); fetchMyClaims(); }}
                    onTogglePurchased={() => {}}
                    onDelete={() => {}}
                    onSetPriority={() => {}}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Activity View */}
        {view === 'activity' && (
          <>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.5rem',
              fontWeight: 400,
              color: defaultTheme.text,
              margin: '0 0 1.5rem',
            }}>
              📰 Recent Activity
            </h2>
            <div style={{
              background: defaultTheme.glass,
              border: `1px solid ${defaultTheme.glassBorder}`,
              borderRadius: '1rem',
              backdropFilter: 'blur(20px)',
              overflow: 'hidden',
            }}>
              {activity.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: defaultTheme.textDim }}>
                  No activity yet
                </div>
              ) : (
                activity.map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      padding: '0.85rem 1.25rem',
                      borderBottom: i < activity.length - 1 ? `1px solid ${defaultTheme.glassBorder}` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{getActivityEmoji(a.action)}</span>
                    <span style={{ flex: 1, color: defaultTheme.text }}>
                      <strong>{a.actor_name}</strong> {getActivityVerb(a.action)}{' '}
                      {a.item_title && <span style={{ color: defaultTheme.textDim }}>"{a.item_title}"</span>}
                      {a.action !== 'claimed' && a.action !== 'unclaimed' && (
                        <span style={{ color: defaultTheme.textDim }}> on {a.list_emoji} {a.list_name}</span>
                      )}
                      {a.action === 'claimed' && <span style={{ color: defaultTheme.textDim }}> on {a.list_emoji} {a.list_name}</span>}
                    </span>
                    <span style={{ color: defaultTheme.textDim, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Nav Button ──────────────────────────────────────────────────────────────

function NavButton({ active, onClick, accent, badge, children }: {
  active: boolean;
  onClick: () => void;
  accent: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? `${accent}22` : 'transparent',
        border: `1px solid ${active ? `${accent}66` : 'transparent'}`,
        borderRadius: '0.5rem',
        padding: '0.4rem 0.85rem',
        color: active ? accent : defaultTheme.textDim,
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.2s ease',
        position: 'relative',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          background: accent,
          color: '#fff',
          borderRadius: '50%',
          width: '18px',
          height: '18px',
          fontSize: '0.65rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Item Card ───────────────────────────────────────────────────────────────

function ItemCard({ item, user, isOwner, isSharedList, accent, onClaim, onTogglePurchased, onDelete, onSetPriority }: {
  item: Item;
  user: User;
  isOwner: boolean;
  isSharedList: boolean;
  accent: string;
  onClaim: () => void;
  onTogglePurchased: () => void;
  onDelete: () => void;
  onSetPriority: (p: number) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const isPurchased = !!item.purchased;
  const isClaimed = !!item.claimed_by;
  const isClaimedByMe = item.claimed_by === user.id;

  // Determine status
  let statusLabel = '';
  let statusColor = '';
  if (isPurchased) {
    statusLabel = '✅ Received';
    statusColor = defaultTheme.success;
  } else if (isClaimed && isClaimedByMe) {
    statusLabel = '🎯 Claimed by you';
    statusColor = accent;
  } else if (isClaimed) {
    statusLabel = '🔐 Claimed';
    statusColor = '#fbbf24';
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: defaultTheme.glass,
        border: `1px solid ${defaultTheme.glassBorder}`,
        borderRadius: '1rem',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 8px 32px ${accent}33` : '0 2px 8px rgba(0,0,0,0.3)',
        opacity: isPurchased ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Priority indicator */}
      {item.priority >= 1 && (
        <div style={{
          background: item.priority === 2 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          padding: '0.2rem 0.6rem',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {item.priority === 2 ? '🔥 Must Have' : '⬆️ High Priority'}
        </div>
      )}

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
          background: `linear-gradient(135deg, ${accent}1a, rgba(96,165,250,0.1))`,
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
          color: isPurchased ? defaultTheme.textDim : defaultTheme.text,
          lineHeight: 1.3,
        }}>
          {item.title}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {item.price && (
            <span style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
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
              color: defaultTheme.textDim,
            }}>
              {item.store_name}
            </span>
          )}
          {statusLabel && (
            <span style={{
              background: `${statusColor}22`,
              color: statusColor,
              padding: '0.2rem 0.6rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
            }}>
              {statusLabel}
            </span>
          )}
        </div>

        {item.notes && (
          <p style={{
            color: defaultTheme.textDim,
            fontSize: '0.85rem',
            margin: 0,
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {item.notes}
          </p>
        )}

        {/* Actions */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: accent,
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Buy at {item.store_name || 'Store'} →
          </a>
          <span style={{ flex: 1 }} />

          {/* Claim button: show for non-owners on personal lists, and anyone on shared lists (except their own) */}
          {!isPurchased && !isOwner && !isSharedList && !isClaimed && (
            <button onClick={onClaim} style={actionButtonStyle(accent)}>
              🎯 Claim
            </button>
          )}
          {!isPurchased && isSharedList && !isClaimed && item.added_by !== user.id && (
            <button onClick={onClaim} style={actionButtonStyle(accent)}>
              🎯 Claim
            </button>
          )}
          {/* Unclaim button for claimer */}
          {isClaimedByMe && !isPurchased && (
            <button onClick={onClaim} style={actionButtonStyle('#fbbf24')}>
              ✕ Unclaim
            </button>
          )}

          {/* Owner actions */}
          {(isOwner || isSharedList) && !isClaimed && (
            <button onClick={onTogglePurchased} style={{
              ...actionButtonStyle(defaultTheme.success),
              border: `1px solid ${isPurchased ? 'rgba(74,222,128,0.3)' : defaultTheme.glassBorder}`,
              color: isPurchased ? defaultTheme.success : defaultTheme.textDim,
            }}>
              {isPurchased ? 'Undo' : '✓ Got it'}
            </button>
          )}
          {(isOwner || isSharedList) && (
            <button onClick={onDelete} style={{
              ...actionButtonStyle(defaultTheme.danger),
              opacity: 0.7,
            }}>
              ✕
            </button>
          )}

          {/* Priority setter for owners */}
          {(isOwner || isSharedList) && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={(e) => {
                  const next = item.priority >= 2 ? 0 : item.priority + 1;
                  onSetPriority(next);
                }}
                style={{
                  ...actionButtonStyle(defaultTheme.textDim),
                  minWidth: '28px',
                  padding: '0.25rem',
                }}
                title={item.priority === 0 ? 'Normal' : item.priority === 1 ? 'High' : 'Must Have'}
              >
                {item.priority === 0 ? '☆' : item.priority === 1 ? '⬆' : '🔥'}
              </button>
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.7rem', color: defaultTheme.textDim, marginTop: '0.25rem' }}>
          Added by {item.user_name} · {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const globalStyles: React.CSSProperties = {
  margin: 0,
  padding: 0,
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${defaultTheme.bg} 0%, #1a0a2e 50%, ${defaultTheme.bg} 100%)`,
  color: defaultTheme.text,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${defaultTheme.glassBorder}`,
  borderRadius: '0.5rem',
  padding: '0.65rem 0.85rem',
  color: defaultTheme.text,
  fontSize: '0.95rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function actionButtonStyle(color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${color}44`,
    color,
    padding: '0.25rem 0.6rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    transition: 'all 0.2s ease',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActivityEmoji(action: string): string {
  const map: Record<string, string> = {
    added: '➕',
    claimed: '🎯',
    unclaimed: '↩️',
    purchased: '✅',
    unpurchased: '🔄',
    priority_changed: '⬆️',
    deleted: '🗑️',
  };
  return map[action] || '📌';
}

function getActivityVerb(action: string): string {
  const map: Record<string, string> = {
    added: 'added',
    claimed: 'claimed an item on',
    unclaimed: 'unclaimed an item on',
    purchased: 'marked as received on',
    unpurchased: 'unmarked as received on',
    priority_changed: 'changed priority on',
    deleted: 'removed an item from',
  };
  return map[action] || action;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}