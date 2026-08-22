import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api, API_BASE, followApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRequireAccount } from '../hooks/useRequireAccount';
import CommentsPanel from '../components/CommentsPanel';
import teddyImg from '../teddy_no_results.png';
/* ── Icons (all SVG, no emojis) ── */
const LikeIcon    = ({ active }) => <svg viewBox="0 0 24 24" fill={active ? 'var(--accent)' : 'none'} stroke={active ? 'var(--accent)' : 'currentColor'} strokeWidth="2" width="15" height="15"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
const DislikeIcon = ({ active }) => <svg viewBox="0 0 24 24" fill={active ? '#e06060' : 'none'} stroke={active ? '#e06060' : 'currentColor'} strokeWidth="2" width="15" height="15"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>;
const CommentIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const OpenIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
const PersonIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
const VideoIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
const PostsIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
const PlayIcon    = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5,3 19,12 5,21"/></svg>;
const SearchIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;

/* ── Helpers ── */
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

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

/* ── Markdown renderer (same as Home.js) ── */
function MarkdownRenderer({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  function renderInline(str, key) {
    const parts = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`|>!(.+?)!<|\^\((.+?)\)|\[([^\]]+)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\))/g;
    let last = 0, m, idx = 0;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(<span key={`t${key}-${idx++}`}>{str.slice(last, m.index)}</span>);
      if (m[2] !== undefined)  parts.push(<strong key={`b${key}-${idx++}`}>{m[2]}</strong>);
      else if (m[3] !== undefined) parts.push(<em key={`i${key}-${idx++}`}>{m[3]}</em>);
      else if (m[4] !== undefined) parts.push(<del key={`s${key}-${idx++}`}>{m[4]}</del>);
      else if (m[5] !== undefined) parts.push(<code key={`c${key}-${idx++}`} style={{ background: 'var(--bg-hover)', borderRadius: 4, padding: '1px 5px', fontSize: '0.88em', fontFamily: 'monospace', color: 'var(--accent)' }}>{m[5]}</code>);
      else if (m[6] !== undefined) parts.push(<span key={`sp${key}-${idx++}`} style={{ background: 'var(--bg-hover)', color: 'transparent', borderRadius: 4, padding: '0 4px', cursor: 'pointer', userSelect: 'none' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'transparent'}>{m[6]}</span>);
      else if (m[7] !== undefined) parts.push(<sup key={`su${key}-${idx++}`} style={{ fontSize: '0.75em' }}>{m[7]}</sup>);
      else if (m[11] !== undefined) parts.push(<img key={`img${key}-${idx++}`} src={m[11]} alt={m[10]} style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '4px 0' }} />);
      else if (m[8] !== undefined) parts.push(<a key={`a${key}-${idx++}`} href={m[9]} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>{m[8]}</a>);
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(<span key={`t${key}-end`}>{str.slice(last)}</span>);
    return parts.length ? parts : str;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const codeLines = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(<pre key={`pre${i}`} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', overflowX: 'auto', margin: '6px 0', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre' }}><code>{codeLines.join('\n')}</code></pre>);
      i++; continue;
    }
    const h1 = line.match(/^# (.+)/), h2 = line.match(/^## (.+)/), h3 = line.match(/^### (.+)/);
    if (h1) { elements.push(<h1 key={i} style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px', color: 'var(--text-primary)' }}>{renderInline(h1[1], i)}</h1>); i++; continue; }
    if (h2) { elements.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 700, margin: '6px 0 4px', color: 'var(--text-primary)' }}>{renderInline(h2[1], i)}</h2>); i++; continue; }
    if (h3) { elements.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 2px', color: 'var(--text-primary)' }}>{renderInline(h3[1], i)}</h3>); i++; continue; }
    if (line.startsWith('> ')) {
      const q = []; while (i < lines.length && lines[i].startsWith('> ')) { q.push(lines[i].slice(2)); i++; }
      elements.push(<blockquote key={`bq${i}`} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, margin: '6px 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{q.map((l, li) => <p key={li} style={{ margin: '2px 0' }}>{renderInline(l, `bq${i}-${li}`)}</p>)}</blockquote>);
      continue;
    }
    if (line.match(/^- .+/)) {
      const items = []; while (i < lines.length && lines[i].match(/^- .+/)) { items.push(lines[i].slice(2)); i++; }
      elements.push(<ul key={`ul${i}`} style={{ paddingLeft: 20, margin: '4px 0' }}>{items.map((item, li) => <li key={li} style={{ marginBottom: 2, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6 }}>{renderInline(item, `ul${i}-${li}`)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === '') { elements.push(<div key={`br${i}`} style={{ height: 6 }} />); i++; continue; }
    elements.push(<p key={i} style={{ margin: '2px 0', fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)' }}>{renderInline(line, i)}</p>);
    i++;
  }
  return <>{elements}</>;
}

function PostContent({ content }) {
  const lines = (content || '').split('\n');
  const isTruncated = lines.length > 6;
  const preview = isTruncated ? lines.slice(0, 6).join('\n') : content;
  return (
    <div>
      <div style={{ display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        <MarkdownRenderer text={preview} />
      </div>
      {isTruncated && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>...</span>}
    </div>
  );
}

/* ── Post card — identical structure/style to Home.js ── */
function PostCard({ post, userId, onOpenComments, onNavigateProfile, onNavigatePost }) {
  const requireAccount = useRequireAccount();
  const [mediaIdx, setMediaIdx] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followChecked, setFollowChecked] = useState(false);
  const [votes, setVotes] = useState({ userVote: post.userVote, likeCount: post.likeCount || 0, dislikeCount: post.dislikeCount || 0 });
  const isOwn = post.authorId === userId;

  const mediaItems = post.mediaItems && post.mediaItems.length > 0
    ? post.mediaItems.map(m => ({ src: m.mediaUrl.startsWith('http') ? m.mediaUrl : `${API_BASE}${m.mediaUrl}`, type: m.mediaType }))
    : post.mediaUrl ? [{ src: post.mediaUrl.startsWith('http') ? post.mediaUrl : `${API_BASE}${post.mediaUrl}`, type: post.mediaType }] : [];

  useEffect(() => {
    if (!userId || isOwn) { setFollowChecked(true); return; }
    followApi.status(post.authorId, userId).then(f => { setFollowing(f.following); setFollowChecked(true); }).catch(() => setFollowChecked(true));
  }, [post.authorId, userId, isOwn]);

  async function handleFollow(e) {
    e.stopPropagation();
    try { const r = await followApi.toggle(post.authorId); setFollowing(r.following); } catch {}
  }

  async function handleVote(type) {
    if (!requireAccount('like or dislike posts')) return;
    try {
      const res = await api.votePost(post.id, type);
      setVotes({ userVote: res.userVote, likeCount: res.likeCount || 0, dislikeCount: res.dislikeCount || 0 });
    } catch {}
  }

  return (
    <div className="card">
      {/* Author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar src={post.authorAvatar} name={post.authorDisplayName || post.authorUsername} onClick={() => onNavigateProfile(post.authorUsername)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{post.authorDisplayName || post.authorUsername}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{post.authorUsername} · {fmtTime(post.createdAt)}</div>
        </div>
        {!isOwn && userId && followChecked && (
          <button onClick={handleFollow} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: following ? '1px solid var(--border-input)' : 'none', background: following ? 'var(--bg-hover)' : 'var(--accent)', color: following ? 'var(--text-muted)' : '#fff', flexShrink: 0, transition: 'all 0.15s' }}>
            {following ? '✓ Following' : '+ Follow'}
          </button>
        )}
      </div>

      {/* Clickable content */}
      <div style={{ cursor: 'pointer' }} onClick={() => onNavigatePost(post.slug)}>
        {post.title && <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{post.title}</p>}
        {post.content && <div style={{ marginBottom: mediaItems.length ? 10 : 0 }}><PostContent content={post.content} /></div>}

        {mediaItems.length > 0 && (
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '16/9', marginTop: post.content ? 10 : 0, marginBottom: 12 }} onClick={e => e.stopPropagation()}>
            {mediaItems[mediaIdx].type === 'VIDEO'
              ? <video src={mediaItems[mediaIdx].src} controls style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              : <img src={mediaItems[mediaIdx].src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}
            {mediaIdx > 0 && (
              <button onClick={() => setMediaIdx(i => i - 1)} style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {mediaIdx < mediaItems.length - 1 && (
              <button onClick={() => setMediaIdx(i => i + 1)} style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            {mediaItems.length > 1 && (
              <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 2 }}>
                {mediaItems.map((_, idx) => <button key={idx} onClick={() => setMediaIdx(idx)} style={{ width: idx === mediaIdx ? 16 : 6, height: 6, borderRadius: 3, padding: 0, border: 'none', cursor: 'pointer', background: idx === mediaIdx ? '#fff' : 'rgba(255,255,255,0.45)', transition: 'width 0.2s' }} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button onClick={() => handleVote('LIKE')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: votes.userVote === 'LIKE' ? 'rgba(79,172,254,0.12)' : 'var(--bg-hover)', border: `1px solid ${votes.userVote === 'LIKE' ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 20, color: votes.userVote === 'LIKE' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <LikeIcon active={votes.userVote === 'LIKE'} /> {votes.likeCount > 0 ? votes.likeCount : 'Like'}
        </button>
        <button onClick={() => handleVote('DISLIKE')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: votes.userVote === 'DISLIKE' ? 'rgba(224,96,96,0.08)' : 'var(--bg-hover)', border: `1px solid ${votes.userVote === 'DISLIKE' ? '#e06060' : 'var(--border-input)'}`, borderRadius: 20, color: votes.userVote === 'DISLIKE' ? '#e06060' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <DislikeIcon active={votes.userVote === 'DISLIKE'} /> {votes.dislikeCount > 0 && votes.dislikeCount}
        </button>
        <button onClick={() => onOpenComments(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 20, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <CommentIcon /> {post.commentCount > 0 ? post.commentCount : 'Comment'}
        </button>
        <button onClick={() => onNavigatePost(post.slug)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 20, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <OpenIcon /> Open
        </button>
      </div>
    </div>
  );
}

/* ── Person card ── */
function PersonCard({ u, currentUserId, onViewProfile }) {
  const [following, setFollowing] = useState(false);
  const name = u.displayName || u.username;

  useEffect(() => {
    if (!currentUserId || currentUserId === u.id) return;
    followApi.status(u.id, currentUserId).then(r => setFollowing(r.following)).catch(() => {});
  }, [u.id, currentUserId]);

  async function toggle(e) {
    e.stopPropagation();
    try { const r = await followApi.toggle(u.id); setFollowing(r.following); } catch {}
  }

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
        {currentUserId && currentUserId !== u.id && (
          <button onClick={toggle} style={{ padding: '8px 24px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0, background: following ? 'none' : 'var(--accent)', border: following ? '1px solid var(--border-input)' : 'none', color: following ? 'var(--text-muted)' : '#fff', transition: 'all 0.15s' }}>
            {following ? 'Following' : '+ Follow'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Media card (matches Media page grid style) ── */
function MediaCard({ v, onNavigate, onProfileClick }) {
  const thumb = v.thumbnailUrl ? (v.thumbnailUrl.startsWith('http') ? v.thumbnailUrl : `${API_BASE}${v.thumbnailUrl}`) : null;
  const name = v.authorDisplayName || v.authorUsername;
  return (
    <div onClick={() => onNavigate(v.id)}
      style={{ cursor: 'pointer', borderRadius: 0, overflow: 'hidden', borderBottom: '1px solid var(--border)', transition: 'background 0.15s', display: 'flex', flexDirection: 'row', width: '100%' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {/* Thumbnail */}
      <div style={{ flexShrink: 0, width: 420, aspectRatio: '16/9', background: '#000', position: 'relative', overflow: 'hidden' }}>
        {thumb
          ? <img src={thumb} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}><PlayIcon /></div>}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.35)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
        </div>
        <div style={{ position: 'absolute', bottom: 5, right: 6, background: 'rgba(0,0,0,0.78)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>
          {fmtNum(v.viewCount)} views
        </div>
      </div>
      {/* Details */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {v.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtNum(v.viewCount)} views · {fmtTime(v.createdAt)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}
          onClick={e => { e.stopPropagation(); onProfileClick(v.authorId); }}>
          <Avatar src={v.authorAvatar} name={name} size={28} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{name}</span>
        </div>
        {v.description && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {v.description}
          </div>
        )}
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

/* ── TABS ── */
const TABS = [
  { id: 'Posts',  Icon: PostsIcon  },
  { id: 'People', Icon: PersonIcon },
  { id: 'Media',  Icon: VideoIcon  },
];

/* ── Main SearchPage ── */
export default function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [query,     setQuery]     = useState(params.get('q') || '');
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'Posts');
  const [people,    setPeople]    = useState([]);
  const [posts,     setPosts]     = useState([]);
  const [videos,    setVideos]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [comments,  setComments]  = useState(null);

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setPeople([]); setPosts([]); setVideos([]); return; }
    setLoading(true);
    try {
      const [p, po, v] = await Promise.all([
        api.searchUsers(q.trim()),
        api.searchPosts(q.trim(), user?.id),
        api.searchMedia(q.trim(), user?.id),
      ]);
      setPeople(p.filter(u2 => u2.id !== user?.id));
      setPosts(po);
      setVideos(v);
    } catch {}
    finally { setLoading(false); }
  }, [user?.id]);

  /* Run search when query changes */
  useEffect(() => { runSearch(query); }, [query, runSearch]);

  /* Write tab to URL (only tab changes, not query — query comes from TopBar navigation) */
  useEffect(() => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', activeTab);
      return next;
    }, { replace: true });
  }, [activeTab, setParams]);

  /* Sync query from URL only when TopBar navigates here (location key changes = new navigation) */
  const locationKey = useLocation().key;
  useEffect(() => {
    const q = params.get('q') || '';
    setQuery(q);
    // eslint-disable-next-line
  }, [locationKey]);

  const counts = { Posts: posts.length, People: people.length, Media: videos.length };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>

      {/* ── Top: tabs only (search bar lives in TopBar) ── */}
      <div style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)', padding: '0 24px 0', position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Tabs — only visible when there's a query */}
        {query && (
          <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
            {TABS.map(({ id }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 20px',
                fontSize: 14, fontWeight: 600,
                color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab === id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                {id}
                {counts[id] > 0 && (
                  <span style={{ fontSize: 11, background: activeTab === id ? 'var(--accent)' : 'var(--bg-hover)', color: activeTab === id ? '#fff' : 'var(--text-muted)', borderRadius: 10, padding: '1px 7px', fontWeight: 700, lineHeight: '16px' }}>
                    {counts[id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div style={{ flex: 1, width: '100%', alignSelf: 'flex-start', padding: '20px 24px 60px', boxSizing: 'border-box' }}>
        <style>{`@media (max-width: 600px) { .search-results-wrap { width: 100% !important; } }`}</style>

        {/* No query — prompt */}
        {!query && !loading && (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, opacity: 0.15 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="72" height="72"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Search Skepticall</div>
            <div style={{ fontSize: 14 }}>Find posts, people, and videos</div>
          </div>
        )}

        {/* Loading */}
        {query && loading && <Skeleton count={5} />}

        {/* Results per tab */}
        {query && !loading && (
          <div className="search-results-wrap" style={{ width: '66.666%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeTab === 'Posts' && (
              posts.length === 0
                ? <EmptyTab Icon={PostsIcon} label="No posts found" sub={`Nothing matched "${query}"`} query={query} />
                : posts.map(p => (
                    <PostCard key={p.id} post={p} userId={user?.id}
                      onOpenComments={id => setComments(id)}
                      onNavigateProfile={id => navigate(`/profile/${id}`)}
                      onNavigatePost={id => navigate(`/post/${id}`)}
                    />
                  ))
            )}
            {activeTab === 'People' && (
              people.length === 0
                ? <EmptyTab Icon={PersonIcon} label="No people found" sub={`No users matched "${query}"`} query={query} />
                : people.map(u => <PersonCard key={u.id} u={u} currentUserId={user?.id} onViewProfile={id => navigate(`/profile/${id}`)} />)
            )}
            {activeTab === 'Media' && (
              videos.length === 0
                ? <EmptyTab Icon={VideoIcon} label="No media found" sub={`Nothing matched "${query}"`} query={query} />
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {videos.map(v => <MediaCard key={v.id} v={v} onNavigate={id => navigate(`/media/${id}`)} onProfileClick={id => navigate(`/profile/${id}`)} />)}
                  </div>
            )}
          </div>
        )}
      </div>

      {comments  && <CommentsPanel postId={comments} userId={user?.id} onClose={() => setComments(null)} />}

    </div>
  );
}