import React, { useState, useEffect, useCallback, useRef } from 'react';

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

interface Tag {
  id: string;
  name: string;
}

interface PriceSnapshot {
  id: string;
  item_id: string;
  price: string;
  scraped_at: string;
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
  occasion_id: string | null;
  tags?: Tag[];
}

interface Occasion {
  id: string;
  list_id: string;
  name: string;
  date: string;
  emoji: string;
  created_at: string;
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
  bg: 'var(--bg-deep)',
  glass: 'var(--glass)',
  glassHover: 'var(--glass-hover)',
  glassBorder: 'var(--glass-border)',
  text: 'var(--text)',
  textDim: 'var(--text-dim)',
  danger: 'var(--danger)',
  success: 'var(--success)',
  warning: 'var(--warning)',
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [lists, setLists] = useState<WishList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [myClaims, setMyClaims] = useState<Item[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lists' | 'claims' | 'activity'>('lists');
  const [isMobile, setIsMobile] = useState(false);

  // Filters
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeOccasionFilter, setActiveOccasionFilter] = useState<string | null>(null);

  // Form state
  const [urlInput, setUrlInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Manual mode
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualImage, setManualImage] = useState('');
  const [manualStore, setManualStore] = useState('');

  // Occasion selector in form
  const [selectedOccasionId, setSelectedOccasionId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Occasions panel
  const [showOccasions, setShowOccasions] = useState(false);

  // Smart import state
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [smartImportUrl, setSmartImportUrl] = useState('');
  const [smartImportDetecting, setSmartImportDetecting] = useState(false);
  const [smartImportItems, setSmartImportItems] = useState<Array<{ url: string; title: string; price: string | null; image: string | null; store: string | null; selected: boolean }>>([]);
  const [smartImportType, setSmartImportType] = useState<string | null>(null);
  const [smartImporting, setSmartImporting] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          fetchTags();
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
          fetchListOccasions(data[0].id);
        } else if (activeListId) {
          fetchListItems(activeListId);
          fetchListOccasions(activeListId);
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

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags', { credentials: 'include' });
      if (res.ok) setTags(await res.json());
    } catch {}
  }, []);

  const fetchListOccasions = useCallback(async (listId: string) => {
    try {
      const res = await fetch(`/api/lists/${listId}/occasions`, { credentials: 'include' });
      if (res.ok) setOccasions(await res.json());
    } catch {}
  }, []);

  const switchList = (listId: string) => {
    setActiveListId(listId);
    setItems([]);
    setActiveTagFilter(null);
    setActiveOccasionFilter(null);
    fetchListItems(listId);
    fetchListOccasions(listId);
  };

  const activeList = lists.find(l => l.id === activeListId);
  const isOwnerOfActiveList = activeList?.owner_id === user?.id;
  const isSharedList = activeList?.owner_id === null;

  const filteredItems = items.filter(item => {
    const tagMatch = activeTagFilter ? item.tags?.some(t => t.id === activeTagFilter) : true;
    const occasionMatch = activeOccasionFilter ? item.occasion_id === activeOccasionFilter : true;
    return tagMatch && occasionMatch;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || submitting || !activeListId) return;
    setSubmitting(true);
    setError('');
    try {
      const payload: any = {
        url: urlInput.trim(),
        notes: notesInput.trim() || undefined,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        occasion_id: selectedOccasionId || undefined,
      };
      if (manualMode) {
        payload.title = manualTitle.trim() || undefined;
        payload.price = manualPrice.trim() || undefined;
        payload.image_url = manualImage.trim() || undefined;
        payload.store_name = manualStore.trim() || undefined;
      }
      const res = await fetch(`/api/lists/${activeListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setUrlInput('');
        setNotesInput('');
        setSelectedTagIds([]);
        setSelectedOccasionId('');
        setManualMode(false);
        setManualTitle('');
        setManualPrice('');
        setManualImage('');
        setManualStore('');
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

  const handleSmartDetect = async () => {
    if (!smartImportUrl.trim()) return;
    setSmartImportDetecting(true);
    setError('');
    try {
      const res = await fetch('/api/smart-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: smartImportUrl.trim() }),
      });
      const data = await res.json();
      if (data.type && data.items.length > 0) {
        setSmartImportType(data.type);
        setSmartImportItems(data.items.map((i: any) => ({ ...i, selected: true })));
      } else {
        setError(data.message || 'No wishlist detected at that URL');
      }
    } catch {
      setError('Failed to detect wishlist');
    } finally {
      setSmartImportDetecting(false);
    }
  };

  const handleSmartImport = async () => {
    if (!activeListId) return;
    const selected = smartImportItems.filter(i => i.selected);
    if (selected.length === 0) return;
    setSmartImporting(true);
    try {
      const res = await fetch('/api/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listId: activeListId, items: selected }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowSmartImport(false);
        setSmartImportUrl('');
        setSmartImportItems([]);
        setSmartImportType(null);
        await fetchListItems(activeListId);
        fetchMyClaims();
        fetchActivity();
      } else {
        const data = await res.json();
        setError(data.error || 'Import failed');
      }
    } catch {
      setError('Import failed');
    } finally {
      setSmartImporting(false);
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

  const handleCheckPrice = async (item: Item) => {
    try {
      const res = await fetch(`/api/items/${item.id}/rescrape`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchListItems(item.list_id);
      }
    } catch {}
  };

  const handleAddOccasion = async (name: string, date: string, emoji: string) => {
    if (!activeListId) return;
    try {
      const res = await fetch(`/api/lists/${activeListId}/occasions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, date, emoji }),
      });
      if (res.ok) {
        fetchListOccasions(activeListId);
      }
    } catch {}
  };

  const handleDeleteOccasion = async (occasionId: string) => {
    if (!confirm('Remove this occasion?')) return;
    try {
      const res = await fetch(`/api/occasions/${occasionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchListOccasions(activeListId || '');
      }
    } catch {}
  };

  // Detect share-target query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('url') || params.get('text') || '';
    if (sharedUrl && user) {
      const u = sharedUrl.match(/https?:\/\/[^\s]+/)?.[0] || sharedUrl;
      if (u.startsWith('http')) {
        setUrlInput(u);
        setView('lists');
      }
    }
  }, [user]);

  const pendingCount = filteredItems.filter(i => !i.purchased && !i.claimed_by).length;
  const claimedCount = filteredItems.filter(i => i.claimed_by && !i.purchased).length;
  const purchasedCount = filteredItems.filter(i => i.purchased).length;

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
            cursor: 'pointer'
          }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Main View ──────────────────────────────────────────────────────

  const accent = activeList?.accent || '#c084fc';
  const formCanSubmit = urlInput.trim().length > 0 && (!manualMode || manualTitle.trim().length > 0);

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

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1rem 0.75rem' : '2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '1rem' : '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: isMobile ? '1.6rem' : '2rem',
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
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => switchList(list.id)}
                  style={{
                    background: activeListId === list.id ? `${list.accent}22` : defaultTheme.glass,
                    border: `1px solid ${activeListId === list.id ? `${list.accent}66` : defaultTheme.glassBorder}`,
                    borderRadius: '0.75rem',
                    padding: isMobile ? '0.55rem 0.9rem' : '0.6rem 1.2rem',
                    color: activeListId === list.id ? list.accent : defaultTheme.textDim,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: activeListId === list.id ? 600 : 400
                    transition: 'all 0.2s ease',
                    fontFamily: "'Inter', sans-serif",
                    minHeight: '44px',
                  }}
                >
                  {list.emoji} {list.name}
                </button>
              ))}
            </div>

            {/* Tag filter bar */}
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveTagFilter(null)}
                  style={tagChipStyle(activeTagFilter === null, accent)}
                >
                  All
                </button>
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
                    style={tagChipStyle(activeTagFilter === tag.id, accent)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            {/* Occasion filter bar */}
            {occasions.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveOccasionFilter(null)}
                  style={tagChipStyle(activeOccasionFilter === null, accent)}
                >
                  Anytime
                </button>
                {occasions.map(occ => (
                  <button
                    key={occ.id}
                    onClick={() => setActiveOccasionFilter(activeOccasionFilter === occ.id ? null : occ.id)}
                    style={tagChipStyle(activeOccasionFilter === occ.id, accent)}
                  >
                    {occ.emoji} {occ.name}
                  </button>
                ))}
              </div>
            )}

            {/* List Stats */}
            {activeList && (
              <p style={{ color: defaultTheme.textDim, fontSize: '0.85rem', margin: '0 0 1rem' }}>
                {pendingCount} available · {claimedCount} claimed · {purchasedCount} received
              </p>
            )}

            {/* Occasions Panel */}
            {(isOwnerOfActiveList || isSharedList) && (
              <OccasionsPanel
                occasions={occasions}
                show={showOccasions}
                onToggle={() => setShowOccasions(s => !s)}
                accent={accent}
                onAdd={handleAddOccasion}
                onDelete={handleDeleteOccasion}
              />
            )}

            {/* Add Item Form */}
            {activeListId && (isOwnerOfActiveList || isSharedList) && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <AddItemForm
                    isMobile={isMobile}
                    accent={accent}
                    manualMode={manualMode}
                    setManualMode={setManualMode}
                    urlInput={urlInput}
                    setUrlInput={setUrlInput}
                    notesInput={notesInput}
                    setNotesInput={setNotesInput}
                    manualTitle={manualTitle}
                    setManualTitle={setManualTitle}
                    manualPrice={manualPrice}
                    setManualPrice={setManualPrice}
                    manualImage={manualImage}
                    setManualImage={setManualImage}
                    manualStore={manualStore}
                    setManualStore={setManualStore}
                    selectedOccasionId={selectedOccasionId}
                    setSelectedOccasionId={setSelectedOccasionId}
                    selectedTagIds={selectedTagIds}
                    setSelectedTagIds={setSelectedTagIds}
                    occasions={occasions}
                    tags={tags}
                    submitting={submitting}
                    onSubmit={handleAdd}
                    canSubmit={formCanSubmit}
                  />
                </div>
                <button
                  onClick={() => setShowSmartImport(true)}
                  style={{
                    background: defaultTheme.glass,
                    border: `1px solid ${defaultTheme.glassBorder}`,
                    borderRadius: '1rem',
                    padding: '0.65rem 1rem',
                    color: accent,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500
                    whiteSpace: 'nowrap',
                    minHeight: '44px',
                    alignSelf: 'flex-end',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  title="Import from Amazon Wishlist or Etsy Favorites"
                >
                  📥 Bulk Import
                </button>
              </div>
            )}

            {/* Smart Import Modal */}
            {showSmartImport && (
              <div style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: '1rem',
              }}>
                <div style={{
                  background: '#1a1a2e',
                  border: `1px solid ${defaultTheme.glassBorder}`,
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  maxWidth: '600px',
                  width: '100%',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{
                      fontFamily: 'Georgia, serif', fontSize: '1.3rem',
                      fontWeight: 400, color: defaultTheme.text, margin: 0,
                    }}>
                      📥 Bulk Import
                    </h2>
                    <button onClick={() => { setShowSmartImport(false); setSmartImportItems([]); setSmartImportType(null); }} style={{
                      background: 'transparent', border: 'none', color: defaultTheme.textDim,
                      fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem',
                    }}>✕</button>
                  </div>

                  <p style={{ color: defaultTheme.textDim, fontSize: '0.85rem', margin: '0 0 1rem' }}>
                    Paste an Amazon Wishlist or Etsy Favorites URL to import items in bulk.
                  </p>

                  {/* URL input */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      type="url"
                      value={smartImportUrl}
                      onChange={e => setSmartImportUrl(e.target.value)}
                      placeholder="https://www.amazon.com/hz/wishlist/ls/..."
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={handleSmartDetect}
                      disabled={smartImportDetecting}
                      style={{
                        background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                        border: 'none',
                        borderRadius: '0.5rem',
                        padding: '0.65rem 1.2rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: smartImportDetecting ? 'wait' : 'pointer',
                        opacity: smartImportDetecting ? 0.6 : 1,
                        minHeight: '44px',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {smartImportDetecting ? 'Detecting…' : 'Detect'}
                    </button>
                  </div>

                  {/* Detected items */}
                  {smartImportItems.length > 0 && (
                    <>
                      <div style={{
                        background: `${accent}15`,
                        border: `1px solid ${accent}33`,
                        borderRadius: '0.5rem',
                        padding: '0.6rem 0.85rem',
                        marginBottom: '0.75rem',
                        fontSize: '0.85rem',
                        color: accent,
                      }}>
                        {smartImportType === 'amazon-wishlist' ? '📦' : '🧶'} Detected {smartImportItems.length} items — select which to import
                      </div>

                      <div style={{
                        maxHeight: '300px',
                        overflow: 'auto',
                        marginBottom: '1rem',
                        border: `1px solid ${defaultTheme.glassBorder}`,
                        borderRadius: '0.5rem',
                      }}>
                        {smartImportItems.map((item, i) => (
                          <label key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.6rem 0.85rem',
                            borderBottom: i < smartImportItems.length - 1 ? `1px solid ${defaultTheme.glassBorder}` : 'none',
                            cursor: 'pointer',
                            color: defaultTheme.text,
                            fontSize: '0.85rem',
                          }}>
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => {
                                const updated = [...smartImportItems];
                                updated[i] = { ...updated[i], selected: !updated[i].selected };
                                setSmartImportItems(updated);
                              }}
                              style={{ accentColor: accent }}
                            />
                            <span style={{ flex: 1 }}>{item.title}</span>
                            {item.price && <span style={{ color: accent, fontWeight: 600 }}>${item.price}</span>}
                            {item.store && <span style={{ color: defaultTheme.textDim, fontSize: '0.75rem' }}>{item.store}</span>}
                          </label>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <span style={{ color: defaultTheme.textDim, fontSize: '0.85rem', alignSelf: 'center' }}>
                          {smartImportItems.filter(i => i.selected).length} items selected
                        </span>
                        <button
                          onClick={handleSmartImport}
                          disabled={smartImporting || smartImportItems.filter(i => i.selected).length === 0}
                          style={{
                            background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.65rem 1.5rem',
                            color: '#fff',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            cursor: smartImporting ? 'wait' : 'pointer',
                            opacity: smartImporting || smartImportItems.filter(i => i.selected).length === 0 ? 0.6 : 1,
                            minHeight: '44px',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {smartImporting ? 'Importing…' : `Import ${smartImportItems.filter(i => i.selected).length} Items`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
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
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: defaultTheme.textDim }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{activeList?.emoji || '🎁'}</div>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', margin: 0 }}>
                  {items.length === 0 ? 'Nothing here yet — paste a URL above!' : 'No items match your filters.'}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: isMobile ? '1rem' : '1.25rem',
              }}>
                {filteredItems.map(item => (
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
                    onCheckPrice={() => handleCheckPrice(item)}
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
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: isMobile ? '1rem' : '1.25rem',
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
                    onCheckPrice={() => handleCheckPrice(item)}
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
              borderRadius: '1rem'
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

// ─── Tag Chip Style ──────────────────────────────────────────────────────────────

function tagChipStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    background: active ? `${accent}22` : defaultTheme.glass,
    border: `1px solid ${active ? `${accent}66` : defaultTheme.glassBorder}`,
    borderRadius: '9999px',
    padding: '0.35rem 0.75rem',
    color: active ? accent : defaultTheme.textDim,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: active ? 600 : 400
    transition: 'all 0.2s ease',
    fontFamily: "'Inter', sans-serif",
    minHeight: '32px',
  };
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
        minHeight: '44px',
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

// ─── Occasions Panel ─────────────────────────────────────────────────────────

function OccasionsPanel({ occasions, show, onToggle, accent, onAdd, onDelete }: {
  occasions: Occasion[];
  show: boolean;
  onToggle: () => void;
  accent: string;
  onAdd: (name: string, date: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [emoji, setEmoji] = useState('🎉');

  if (!show) {
    return (
      <button
        onClick={onToggle}
        style={{
          background: defaultTheme.glass,
          border: `1px solid ${defaultTheme.glassBorder}`,
          borderRadius: '0.75rem',
          padding: '0.55rem 0.9rem',
          color: defaultTheme.textDim,
          cursor: 'pointer',
          fontSize: '0.9rem'
          marginBottom: '1rem',
          minHeight: '44px',
        }}
      >
        📅 Occasions ({occasions.length})
      </button>
    );
  }

  return (
    <div style={{
      background: defaultTheme.glass,
      border: `1px solid ${defaultTheme.glassBorder}`,
      borderRadius: '1rem',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ color: defaultTheme.text, fontWeight: 600, fontSize: '0.95rem' }}>📅 Occasions</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', color: defaultTheme.textDim, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>

      {occasions.length === 0 && <p style={{ color: defaultTheme.textDim, fontSize: '0.85rem' }}>No occasions yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {occasions.map(occ => (
          <div key={occ.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass)',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: defaultTheme.text }}>
              <span>{occ.emoji}</span>
              <span>{occ.name}</span>
              <span style={{ color: defaultTheme.textDim, fontSize: '0.8rem' }}>{formatOccasionDate(occ.date)}</span>
              <span style={{ color: accent, fontSize: '0.8rem', fontWeight: 600 }}>{daysUntil(occ.date)}</span>
            </div>
            <button onClick={() => onDelete(occ.id)} style={{
              background: 'none', border: 'none', color: defaultTheme.danger, cursor: 'pointer', fontSize: '0.85rem', minHeight: '32px', minWidth: '32px',
            }}>🗑</button>
          </div>
        ))}
      </div>

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ ...actionButtonStyle(accent), minHeight: '44px' }}>+ Add occasion</button>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, flex: '1 1 120px' }} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: '1 1 140px' }} />
          <input placeholder="Emoji" value={emoji} onChange={e => setEmoji(e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
          <button onClick={() => { if (name && date) { onAdd(name, date, emoji); setAdding(false); setName(''); setDate(''); setEmoji('🎉'); }}} style={{ ...actionButtonStyle(accent), minHeight: '44px' }}>Save</button>
          <button onClick={() => setAdding(false)} style={{ ...actionButtonStyle(defaultTheme.textDim), minHeight: '44px' }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function formatOccasionDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(dateStr: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${diff} days`;
}

// ─── Add Item Form ───────────────────────────────────────────────────────────

function AddItemForm({ isMobile, accent, manualMode, setManualMode, urlInput, setUrlInput, notesInput, setNotesInput, manualTitle, setManualTitle, manualPrice, setManualPrice, manualImage, setManualImage, manualStore, setManualStore, selectedOccasionId, setSelectedOccasionId, selectedTagIds, setSelectedTagIds, occasions, tags, submitting, onSubmit, canSubmit }: any) {
  return (
    <div style={isMobile ? addItemSheetStyle : addItemPanelStyle}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', color: defaultTheme.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Add Item
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: defaultTheme.textDim, fontSize: '0.8rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={manualMode} onChange={e => setManualMode(e.target.checked)} style={{ accentColor: accent }} />
            Enter manually
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 260px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://www.etsy.com/listing/..."
              required
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <input
              type="text"
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              placeholder="Size, color, variant..."
              style={inputStyle}
            />
          </div>
        </div>

        {manualMode && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem', background: 'var(--glass)', borderRadius: '0.75rem' }}>
            <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Title *" required={manualMode} style={{ ...inputStyle, flex: '2 1 200px' }} />
            <input type="text" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="Price" style={{ ...inputStyle, flex: '1 1 100px' }} />
            <input type="url" value={manualImage} onChange={e => setManualImage(e.target.value)} placeholder="Image URL" style={{ ...inputStyle, flex: '2 1 200px' }} />
            <input type="text" value={manualStore} onChange={e => setManualStore(e.target.value)} placeholder="Store name" style={{ ...inputStyle, flex: '1 1 130px' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selectedOccasionId} onChange={e => setSelectedOccasionId(e.target.value)} style={{ ...inputStyle, flex: '1 1 160px', minHeight: '44px' }}>
            <option value="">No occasion</option>
            {occasions.map((occ: Occasion) => (
              <option key={occ.id} value={occ.id}>{occ.emoji} {occ.name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: '2 1 220px' }}>
            {tags.map((tag: Tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setSelectedTagIds((prev: string[]) =>
                      prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                    );
                  }}
                  style={tagChipStyle(selected, accent)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
              border: 'none',
              borderRadius: '0.5rem',
              padding: isMobile ? '0.75rem 1.25rem' : '0.65rem 1.5rem',
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting || !canSubmit ? 0.6 : 1,
              transition: 'all 0.2s ease',
              minHeight: '44px',
            }}
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}

const addItemPanelStyle: React.CSSProperties = {
  background: defaultTheme.glass,
  border: `1px solid ${defaultTheme.glassBorder}`,
  borderRadius: '1rem',
  padding: '1.25rem',
  marginBottom: '1.5rem'
};

const addItemSheetStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'var(--bg-deep)',
  borderTop: `1px solid ${defaultTheme.glassBorder}`,
  borderRadius: '1rem 1rem 0 0',
  padding: '1rem'
  zIndex: 50,
  boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
};

// ─── Item Card ───────────────────────────────────────────────────────────────

function ItemCard({ item, user, isOwner, isSharedList, accent, onClaim, onTogglePurchased, onDelete, onSetPriority, onCheckPrice }: {
  item: Item;
  user: User;
  isOwner: boolean;
  isSharedList: boolean;
  accent: string;
  onClaim: () => void;
  onTogglePurchased: () => void;
  onDelete: () => void;
  onSetPriority: (p: number) => void;
  onCheckPrice: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceSnapshot[]>([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const isPurchased = !!item.purchased;
  const isClaimed = !!item.claimed_by;
  const isClaimedByMe = item.claimed_by === user.id;

  const fetchPriceHistory = async () => {
    try {
      const res = await fetch(`/api/items/${item.id}/prices`, { credentials: 'include' });
      if (res.ok) setPriceHistory(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (showPriceHistory) fetchPriceHistory();
  }, [showPriceHistory]);

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

  const previousPrice = priceHistory.length >= 2 ? priceHistory[priceHistory.length - 2].price : null;
  const currentPrice = item.price;
  let priceTrend = '';
  if (previousPrice && currentPrice) {
    const prevNum = parseFloat(previousPrice.replace(/[^0-9.]/g, ''));
    const curNum = parseFloat(currentPrice.replace(/[^0-9.]/g, ''));
    if (!isNaN(prevNum) && !isNaN(curNum)) {
      if (curNum < prevNum) priceTrend = `was ${previousPrice}, now ${currentPrice} ↓`;
      else if (curNum > prevNum) priceTrend = `was ${previousPrice}, now ${currentPrice} ↑`;
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: defaultTheme.glass,
        border: `1px solid ${defaultTheme.glassBorder}`,
        borderRadius: '1rem',
        overflow: 'hidden'
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
          background: 'var(--glass)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={item.image_url}
            alt={item.title}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '0.75rem' }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              // If direct load fails, try the image proxy
              if (item.image_url && !img.src.includes('/api/image-proxy')) {
                img.src = `/api/image-proxy?url=${encodeURIComponent(item.image_url)}`;
              } else {
                img.style.display = 'none';
              }
            }}
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
              background: 'var(--glass)',
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
          {/* Tag chips */}
          {item.tags?.map(tag => (
            <span key={tag.id} style={{
              background: `${accent}1a`,
              color: accent,
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 500,
            }}>
              {tag.name}
            </span>
          ))}
        </div>

        {priceTrend && (
          <div style={{ fontSize: '0.8rem', color: defaultTheme.success }}>
            {priceTrend}
          </div>
        )}

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
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Buy at {item.store_name || 'Store'} →
          </a>
          <span style={{ flex: 1 }} />

          {/* Check price button */}
          {!isPurchased && (
            <button onClick={() => { setShowPriceHistory(!showPriceHistory); if (!showPriceHistory) onCheckPrice(); }} style={{ ...actionButtonStyle(defaultTheme.textDim), minHeight: '44px', minWidth: '44px' }} title="Check price">
              💲
            </button>
          )}

          {/* Claim button: show for non-owners on personal lists, and anyone on shared lists (except their own) */}
          {!isPurchased && !isOwner && !isSharedList && !isClaimed && (
            <button onClick={onClaim} style={{ ...actionButtonStyle(accent), minHeight: '44px' }}>
              🎯 Claim
            </button>
          )}
          {!isPurchased && isSharedList && !isClaimed && item.added_by !== user.id && (
            <button onClick={onClaim} style={{ ...actionButtonStyle(accent), minHeight: '44px' }}>
              🎯 Claim
            </button>
          )}
          {/* Unclaim button for claimer */}
          {isClaimedByMe && !isPurchased && (
            <button onClick={onClaim} style={{ ...actionButtonStyle('#fbbf24'), minHeight: '44px' }}>
              ✕ Unclaim
            </button>
          )}

          {/* Owner actions */}
          {(isOwner || isSharedList) && !isClaimed && (
            <button onClick={onTogglePurchased} style={{
              ...actionButtonStyle(defaultTheme.success),
              border: `1px solid ${isPurchased ? 'rgba(74,222,128,0.3)' : defaultTheme.glassBorder}`,
              color: isPurchased ? defaultTheme.success : defaultTheme.textDim,
              minHeight: '44px',
            }}>
              {isPurchased ? 'Undo' : '✓ Got it'}
            </button>
          )}
          {(isOwner || isSharedList) && (
            <button onClick={onDelete} style={{
              ...actionButtonStyle(defaultTheme.danger),
              opacity: 0.7,
              minHeight: '44px',
              minWidth: '44px',
            }}>
              ✕
            </button>
          )}

          {/* Priority setter for owners */}
          {(isOwner || isSharedList) && (
            <button
              onClick={(e) => {
                const next = item.priority >= 2 ? 0 : item.priority + 1;
                onSetPriority(next);
              }}
              style={{
                ...actionButtonStyle(defaultTheme.textDim),
                minWidth: '44px',
                minHeight: '44px',
                padding: '0.25rem',
              }}
              title={item.priority === 0 ? 'Normal' : item.priority === 1 ? 'High' : 'Must Have'}
            >
              {item.priority === 0 ? '☆' : item.priority === 1 ? '⬆' : '🔥'}
            </button>
          )}
        </div>

        {showPriceHistory && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--glass)', borderRadius: '0.5rem' }}>
            {priceHistory.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: defaultTheme.textDim }}>No price history yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {priceHistory.map((snap) => (
                  <div key={snap.id} style={{ fontSize: '0.8rem', color: defaultTheme.textDim }}>
                    {new Date(snap.scraped_at).toLocaleDateString()}: ${snap.price}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
  background: '' + 'var(--glass)' + '',
  border: `1px solid ${defaultTheme.glassBorder}`,
  borderRadius: '0.5rem',
  padding: '0.65rem 0.85rem',
  color: defaultTheme.text,
  fontSize: '0.95rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '44px',
};

function actionButtonStyle(color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${color}44`,
    color,
    padding: '0.3rem 0.7rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    occasion_created: '📅',
    occasion_deleted: '🗑',
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
    occasion_created: 'created an occasion on',
    occasion_deleted: 'deleted an occasion on',
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
