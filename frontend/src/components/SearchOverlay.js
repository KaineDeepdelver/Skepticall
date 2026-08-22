import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE, followApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtViews(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000) return (n/1000).toFixed(1)+'K';
  return String(n);
}

export default function SearchOverlay({ onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query,     setQuery]     = useState('');
  const [tab,       setTab]       = useState('people'); // people | posts | videos
  const [people,    setPeople]    = useState([]);
  const [posts,     setPosts]     = useState([]);
  const [videos,    setVideos]    = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef();
  const timerRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setPeople([]); setPosts([]); setVideos([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const [p, po, v] = await Promise.all([
          api.searchUsers(query.trim()),
          api.searchPosts(query.trim(), user?.id),
          api.searchMedia(query.trim(), user?.id),
        ]);
        setPeople(p.filter(u => u.id !== user?.id).slice(0, 10));
        setPosts(po.slice(0, 10));
        setVideos(v.slice(0, 10));
      } catch {}
      finally { setSearching(false); }
    }, 300);
  }, [query, user?.id]);

  const tabs = [
    { id: 'people', label: 'People', count: people.length },
    { id: 'posts',  label: 'Posts',  count: posts.length  },
    { id: 'videos', label: 'Videos', count: videos.length },
  ];

  return (
    <>
      {/* Backdrop — clicking it closes */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 800, backdropFilter: 'blur(2px)' }}
      />

      {/* Panel — fixed, does NOT push page content */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 400,
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        zIndex: 801,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.3)',
        animation: 'slideInRight 0.2s ease',
      }}>
        {/* Search input header */}
        <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 24, padding: '10px 16px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search people, posts, videos…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14 }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', marginLeft: 4 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Tabs */}
          {query.trim() && (
            <div style={{ display: 'flex', gap: 4, marginTop: 12, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: 'none', border: 'none', padding: '8px 14px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                }}>
                  {t.label} {t.count > 0 && <span style={{ fontSize: 11, opacity: 0.7 }}>({t.count})</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 20px' }}>
          {!query.trim() ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Search Skepticall</div>
              <div style={{ fontSize: 13 }}>Find people, posts, and videos</div>
            </div>
          ) : searching ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>
          ) : (
            <>
              {/* PEOPLE TAB */}
              {tab === 'people' && (
                people.length === 0 ? <EmptyState label="No people found" /> :
                people.map(u => <PersonRow key={u.id} user={u} currentUserId={user?.id} onViewProfile={id => { onClose(); navigate(`/profile/${id}`); }} />)
              )}

              {/* POSTS TAB */}
              {tab === 'posts' && (
                posts.length === 0 ? <EmptyState label="No posts found" /> :
                posts.map(p => (
                  <div key={p.id} style={{ padding: '12px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <UserAvatar src={p.authorAvatar} name={p.authorDisplayName || p.authorUsername} userId={p.authorId} size={28} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.authorDisplayName || p.authorUsername}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{p.authorUsername} · {fmtTime(p.createdAt)}</div>
                      </div>
                    </div>
                    {p.content && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.content}</div>}
                    {p.mediaUrl && (
                      <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', maxHeight: 140 }}>
                        {p.mediaType === 'VIDEO'
                          ? <video src={p.mediaUrl.startsWith('http') ? p.mediaUrl : `${API_BASE}${p.mediaUrl}`} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                          : <img src={p.mediaUrl.startsWith('http') ? p.mediaUrl : `${API_BASE}${p.mediaUrl}`} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>👍 {p.likeCount}</span><span>💬 {p.commentCount}</span>
                    </div>
                  </div>
                ))
              )}

              {/* VIDEOS TAB */}
              {tab === 'videos' && (
                videos.length === 0 ? <EmptyState label="No videos found" /> :
                videos.map(v => {
                  const thumb = v.thumbnailUrl ? (v.thumbnailUrl.startsWith('http') ? v.thumbnailUrl : `${API_BASE}${v.thumbnailUrl}`) : null;
                  return (
                    <div key={v.id} style={{ display: 'flex', gap: 10, padding: '10px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer', borderRadius: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onClick={onClose}>
                      <div style={{ width: 100, height: 58, borderRadius: 6, background: '#000', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                        {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" width="20" height="20"><polygon points="5,3 19,12 5,21"/></svg></div>}
                        <div style={{ position: 'absolute', bottom: 3, right: 4, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 3 }}>{fmtViews(v.viewCount)}</div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 4 }}>{v.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.authorDisplayName || v.authorUsername} · {fmtTime(v.createdAt)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>👍 {v.likeCount} · 💬 {v.commentCount}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </>
  );
}

function EmptyState({ label }) {
  return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>{label}</div>;
}

function PersonRow({ user: u, currentUserId, onViewProfile }) {
  const [following, setFollowing] = useState(false);
  const [loaded,    setLoaded]    = useState(false);
  const name = u.displayName || u.username;

  async function loadFollow() {
    if (loaded || !currentUserId || currentUserId === u.id) return;
    try { const f = await followApi.status(u.id, currentUserId); setFollowing(f.following); setLoaded(true); } catch {}
  }
  async function handleFollow(e) {
    e.stopPropagation();
    try { const r = await followApi.toggle(u.id); setFollowing(r.following); setLoaded(true); } catch {}
  }

  return (
    <div
      onClick={() => onViewProfile(u.username)}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; loadFollow(); }}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderRadius: 10, transition: 'background 0.15s' }}
    >
      <UserAvatar src={u.profilePicture} name={name} userId={u.id} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username}</div>
      </div>
      {currentUserId && currentUserId !== u.id && (
        <button onClick={handleFollow} style={{ padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: following ? 'var(--bg-hover)' : 'var(--accent)', border: following ? '1px solid var(--border-input)' : 'none', color: following ? 'var(--text-muted)' : '#fff', flexShrink: 0 }}>
          {following ? '✓' : '+ Follow'}
        </button>
      )}
    </div>
  );
}
