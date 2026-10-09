import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api, API_BASE } from '../services/api';
import { useAuth } from '../context/AuthContext';
import teddyImg from '../teddy_no_results.png';

const PersonIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;

/* ── Avatar ── */
function Avatar({ src, name, size = 38, onClick }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const handleClick = onClick ? e => { e.stopPropagation(); onClick(); } : undefined;
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, cursor: onClick ? 'pointer' : 'default', display: 'block' };
  if (src) {
    const url = src.startsWith('http') ? src : `${API_BASE}${src}`;
    return <img src={url} alt={name} style={{ ...base, objectFit: 'cover', border: '2px solid var(--border-input)' }} onClick={handleClick} />;
  }
  return <div style={{ ...base, background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', border: '2px solid var(--border-input)' }} onClick={handleClick}>{initials}</div>;
}

/* ── Person card ── */
function PersonCard({ u, onViewProfile }) {
  const name = u.displayName || u.username;
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={() => onViewProfile(u.username)}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '6px 0' }}>
        <Avatar src={u.profilePicture} name={name} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{name}</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 5 }}>@{u.username}</div>
          {u.bio && <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>{u.bio}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton ── */
function Skeleton({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 120, borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation: 'shimmer 1.4s infinite' }} />
        </div>
      ))}
      <style>{`@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }`}</style>
    </div>
  );
}

/* ── Ripped teddy bear no-results ── */
function TeddyNoResults({ query }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px', gap: 16, width: '100%' }}>
      <img
        src={teddyImg}
        alt="No results"
        style={{ width: 220, opacity: 0.75, userSelect: 'none', pointerEvents: 'none' }}
      />
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-secondary)' }}>No results found for "{query}"</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try a different search term</div>
    </div>
  );
}

/* ── Empty state (generic, for tabs with no query context needed) ── */
function EmptyTab({ Icon, label, sub, query }) {
  if (query) return <TeddyNoResults query={query} />;
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, opacity: 0.25 }}><Icon /></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{sub}</div>
    </div>
  );
}

/* ── Main SearchPage ── */
export default function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [query,   setQuery]   = useState(params.get('q') || '');
  const [people,  setPeople]  = useState([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setPeople([]); return; }
    setLoading(true);
    try {
      const p = await api.searchUsers(q.trim());
      setPeople(p.filter(u2 => u2.id !== user?.id));
    } catch {}
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { runSearch(query); }, [query, runSearch]);

  /* Sync query from URL when TopBar navigates here (location key changes = new navigation) */
  const locationKey = useLocation().key;
  useEffect(() => {
    setQuery(params.get('q') || '');
    // eslint-disable-next-line
  }, [locationKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ flex: 1, width: '100%', alignSelf: 'flex-start', padding: '20px 24px 60px', boxSizing: 'border-box' }}>
        <style>{`@media (max-width: 600px) { .search-results-wrap { width: 100% !important; } }`}</style>

        {!query && !loading && (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, opacity: 0.15 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="72" height="72"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Search Skepticall</div>
            <div style={{ fontSize: 14 }}>Find people</div>
          </div>
        )}

        {query && loading && <Skeleton count={5} />}

        {query && !loading && (
          <div className="search-results-wrap" style={{ width: '66.666%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {people.length === 0
              ? <EmptyTab Icon={PersonIcon} label="No people found" sub={`No users matched "${query}"`} query={query} />
              : people.map(u => <PersonCard key={u.id} u={u} onViewProfile={id => navigate(`/profile/${id}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
