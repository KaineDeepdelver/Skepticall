import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE, followApi, friendApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';


function UserResult({ user: u, currentUserId, onViewProfile }) {
  const [followData,   setFollowData]   = useState({ following: false });
  const [rel,          setRel]          = useState({ status: 'NONE' });
  const [loaded,       setLoaded]       = useState(false);
  const [actionLoading,setActionLoading]= useState(false);

  async function loadState() {
    if (loaded || !currentUserId || currentUserId === u.id) return;
    try {
      const [f, r] = await Promise.all([followApi.status(u.id, currentUserId), friendApi.relationship(u.id, currentUserId)]);
      setFollowData(f); setRel(r); setLoaded(true);
    } catch {}
  }

  async function handleFollow(e) {
    e.stopPropagation();
    if (!currentUserId) return;
    setActionLoading(true);
    try { const res = await followApi.toggle(u.id); setFollowData(res); } catch {}
    finally { setActionLoading(false); }
  }

  async function handleFriend(e) {
    e.stopPropagation();
    if (!currentUserId) return;
    setActionLoading(true);
    try {
      if (rel.status === 'NONE') { const r = await friendApi.sendRequest(u.id); setRel({status: r.status}); }
      else if (rel.status === 'REQUEST_RECEIVED') { const r = await friendApi.respond(rel.requestId, 'ACCEPT'); setRel({...rel,status:r.status}); }
      else if (rel.status === 'FRIENDS' || rel.status === 'REQUEST_SENT') { await friendApi.unfriend(u.id); setRel({status:'NONE'}); }
    } catch {}
    finally { setActionLoading(false); }
  }

  const name = u.displayName || u.username;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; loadState(); }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
      onClick={() => onViewProfile(u.username)}
    >
      <UserAvatar src={u.profilePicture} name={name} userId={u.id} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username}</div>
      </div>
      {currentUserId && currentUserId !== u.id && loaded && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={handleFollow} disabled={actionLoading} style={{
            padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: followData.following ? 'var(--bg-hover)' : 'var(--accent)',
            border: followData.following ? '1px solid var(--border-input)' : 'none',
            color: followData.following ? 'var(--text-muted)' : '#fff',
          }}>
            {followData.following ? '✓' : '+'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef();

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchUsers(q.trim());
        setResults(data.filter(u => u.id !== user?.id).slice(0, 8));
      } catch {}
      finally { setSearching(false); }
    }, 300);
  }

  return (
    <div style={{
      width: 280, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-sidebar)',
      padding: '20px 12px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Search box */}
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={query}
          onChange={handleInput}
          placeholder="Search people…"
          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 20, padding: '9px 12px 9px 34px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
        />
      </div>

      {/* Results */}
      {searching && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>
      )}
      {!searching && query && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>No results for "{query}"</div>
      )}
      {results.map(u => (
        <UserResult key={u.id} user={u} currentUserId={user?.id} onViewProfile={id => navigate(`/profile/${id}`)} />
      ))}

      {/* Suggestions label when empty */}
      {!query && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, padding: '0 4px' }}>
            Find People
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 4px', lineHeight: 1.6 }}>
            Search by username or display name to follow or add friends.
          </div>
        </div>
      )}
    </div>
  );
}
