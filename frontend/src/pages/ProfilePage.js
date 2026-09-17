import MarkdownRenderer from '../components/MarkdownRenderer';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRequireAccount } from '../hooks/useRequireAccount';
import { api, adminApi, API_BASE, followApi, friendApi, resolveUrl } from '../services/api';
import CommentsPanel from '../components/CommentsPanel';
import UserAvatar from '../components/UserAvatar';
import ConfirmModal from '../components/ConfirmModal';

const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtJoin(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}
// == Media grid formatters ==
function fmtDuration(sec) {
  if (sec == null) return null;
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function fmtViews(n) {
  n = n || 0;
  if (n >= 1000000) return (n % 1000000 === 0 ? n / 1000000 : (n / 1000000).toFixed(1)) + 'M';
  if (n >= 1000) return (n % 1000 === 0 ? n / 1000 : (n / 1000).toFixed(1)) + 'K';
  return String(n);
}
function fmtAgo(iso) {
  if (!iso) return '';
  const diff = (new Date() - new Date(iso)) / 1000;
  const units = [
    [60, 'second'], [3600, 'minute'], [86400, 'hour'],
    [604800, 'day'], [2629800, 'week'], [31557600, 'month'], [Infinity, 'year'],
  ];
  if (diff < 60) return 'just now';
  let value, label;
  if (diff < units[1][0]) { value = Math.floor(diff / 60); label = 'minute'; }
  else if (diff < units[2][0]) { value = Math.floor(diff / 3600); label = 'hour'; }
  else if (diff < units[3][0]) { value = Math.floor(diff / 86400); label = 'day'; }
  else if (diff < units[4][0]) { value = Math.floor(diff / 604800); label = 'week'; }
  else if (diff < units[5][0]) { value = Math.floor(diff / 2629800); label = 'month'; }
  else { value = Math.floor(diff / 31557600); label = 'year'; }
  return `${value} ${label}${value === 1 ? '' : 's'} ago`;
}
function avatarSrc(pic) {
  if (!pic) return null;
  return resolveUrl(pic.startsWith('http') ? pic : `${API_BASE}${pic}`);
}
function bannerSrc(pic) {
  if (!pic) return null;
  return resolveUrl(pic.startsWith('http') ? pic : `${API_BASE}${pic}`);
}

// When an item has no server-generated thumbnailUrl, grab a frame straight
// from the video itself (seek to a random point, draw it to a canvas) so the
// grid never falls back to a blank placeholder for videos that just happen
// to be missing a thumbnail.
function AutoFrameThumb({ src, alt, placeholder }) {
  const [frame, setFrame] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFrame(null); setFailed(false); }, [src]);

  function handleLoadedMetadata(e) {
    const v = e.target;
    const dur = v.duration || 0;
    // Random point roughly a tenth to two-thirds into the clip — avoids
    // black opening frames while still varying thumb-to-thumb.
    const t = dur > 1 ? Math.min(dur * (0.1 + Math.random() * 0.55), dur - 0.05) : 0;
    try { v.currentTime = t; } catch { setFailed(true); }
  }

  function handleSeeked(e) {
    const v = e.target;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 320;
      canvas.height = v.videoHeight || 180;
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
      setFrame(canvas.toDataURL('image/jpeg', 0.82));
    } catch {
      // Most likely a cross-origin video without CORS headers, which taints
      // the canvas — fall back to the placeholder rather than throwing.
      setFailed(true);
    }
  }

  if (frame) {
    return <img src={frame} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
  }
  if (failed || !src) return placeholder;
  return (
    <>
      <video
        src={src}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="metadata"
        style={{ display: 'none' }}
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={handleSeeked}
        onError={() => setFailed(true)}
      />
      {placeholder}
    </>
  );
}


function PostCard({ post, onVote, onOpenComments, onDelete, onAdminDelete, userId, isAdmin, onNavigatePost }) {
  const isOwn = post.authorId === userId;
  const mediaSrc = post.mediaUrl ? resolveUrl(post.mediaUrl.startsWith('http') ? post.mediaUrl : `${API_BASE}${post.mediaUrl}`) : null;
  return (
    <div className="omni-page-enter card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <UserAvatar src={post.authorAvatar} name={post.authorDisplayName || post.authorUsername} size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{post.authorDisplayName || post.authorUsername}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{post.authorUsername} · {fmtTime(post.createdAt)}</div>
        </div>
{(isOwn || isAdmin) && (
          <button onClick={() => isOwn ? onDelete(post.id) : onAdminDelete(post.id)}
            title={isOwn ? 'Delete post' : 'Delete post (admin)'}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', marginLeft: 'auto' }}
            onMouseEnter={ev => ev.currentTarget.style.color = '#e06060'}
            onMouseLeave={ev => ev.currentTarget.style.color = 'var(--text-muted)'}>
            <TrashIcon />
          </button>
        )}
      </div>
      {post.content && <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.65, marginBottom: mediaSrc ? 10 : 0 }}><MarkdownRenderer text={post.content} /></div>}
      {mediaSrc && (
        <div style={{ marginTop: 8, marginBottom: 12, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-hover)' }}>
          {(post.mediaType === 'IMAGE' || post.mediaType === 'GIF')
            ? <img src={mediaSrc} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
            : <video src={mediaSrc} controls style={{ width: '100%', maxHeight: 400, display: 'block' }} />}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button onClick={() => onVote(post.id, 'LIKE')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', background: post.userVote === 'LIKE' ? 'rgba(79,172,254,0.15)' : 'var(--bg-hover)', border: `1px solid ${post.userVote === 'LIKE' ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 20, color: post.userVote === 'LIKE' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <svg viewBox="0 0 24 24" fill={post.userVote==='LIKE'?'var(--accent)':'none'} stroke={post.userVote==='LIKE'?'var(--accent)':'currentColor'} strokeWidth="2" width="15" height="15"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> {post.likeCount > 0 && post.likeCount}
        </button>
        <button onClick={() => onVote(post.id, 'DISLIKE')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', background: post.userVote === 'DISLIKE' ? 'rgba(224,96,96,0.08)' : 'var(--bg-hover)', border: `1px solid ${post.userVote === 'DISLIKE' ? '#e06060' : 'var(--border-input)'}`, borderRadius: 20, color: post.userVote === 'DISLIKE' ? '#e06060' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <svg viewBox="0 0 24 24" fill={post.userVote==='DISLIKE'?'#e06060':'none'} stroke={post.userVote==='DISLIKE'?'#e06060':'currentColor'} strokeWidth="2" width="15" height="15"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg> {post.dislikeCount > 0 && post.dislikeCount}
        </button>
        <button onClick={() => onOpenComments(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 20, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> {post.commentCount > 0 ? post.commentCount : 'Comment'}
        </button>
        <button onClick={() => onNavigatePost && onNavigatePost(post.slug)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 20, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const requireAccount = useRequireAccount();
  const navigate = useNavigate();

  // uid is resolved after profile loads
  const [uid,          setUid]          = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [followData,   setFollowData]   = useState({ following: false, followerCount: 0, followingCount: 0 });
  const [relationship, setRelationship] = useState({ status: 'NONE' });
  const [actionLoading, setActionLoading] = useState(false);
  const [showAbout,     setShowAbout]     = useState(false);
  const [posts,        setPosts]        = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsPage,    setPostsPage]    = useState(0);
  const [hasMore,      setHasMore]      = useState(true);
  const [activeTab,    setActiveTab]    = useState('posts');
  const [mediaItems,   setMediaItems]   = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaLoaded,  setMediaLoaded]  = useState(false);
  const [comments,     setComments]     = useState(null);

  const isMe = uid != null && me?.id === uid;
  // Note: the backend DTO field is `isClip` (boolean), but Lombok's generated
  // getter `isClip()` gets bean-introspected by Jackson as property "clip" —
  // so the JSON actually comes back as `clip: true/false`, not `isClip`.
  // Check both so this keeps working if that serialization ever changes.
  const isClipItem = item => !!(item.clip ?? item.isClip);
  const videosOnly = mediaItems.filter(item => !isClipItem(item));
  const clipsOnly  = mediaItems.filter(item => isClipItem(item));
  const BIO_TRUNCATE_AT = 130;
  const bioIsLong  = !!(profile?.bio && profile.bio.length > BIO_TRUNCATE_AT);
  const bioPreview = bioIsLong ? profile.bio.slice(0, BIO_TRUNCATE_AT).trimEnd() : profile?.bio;

  // Load profile + social data by username
  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setUid(null);
    setPosts([]);
    setMediaItems([]);
    setMediaLoaded(false);

    api.getUserByUsername(username)
      .then(async (p) => {
        setProfile(p);
        setUid(p.id);
        const resolvedIsMe = me?.id === p.id;
        const [f, r] = await Promise.all([
          me ? followApi.status(p.id, me.id) : Promise.resolve(null),
          me && !resolvedIsMe ? friendApi.relationship(p.id, me.id) : Promise.resolve(null),
        ]);
        if (f) setFollowData(f);
        if (r) setRelationship(r);
      })
      .catch(() => setProfile(undefined))
      .finally(() => setLoading(false));
  }, [username, me?.id]);

  const loadPosts = useCallback(async (pg = 0) => {
    if (!uid) return;
    setPostsLoading(true);
    try {
      const data = await api.getUserPosts(uid, pg, me?.id);
      setPosts(prev => pg === 0 ? data : [...prev, ...data]);
      setHasMore(data.length === 20);
      setPostsPage(pg);
    } catch {}
    finally { setPostsLoading(false); }
  }, [uid, me?.id]);

  useEffect(() => { if (uid) loadPosts(0); }, [uid, loadPosts]);

  async function loadMedia() {
    if (mediaLoaded || !uid) return;
    setMediaLoading(true);
    try {
      const data = await api.getUserMedia(uid, me?.id);
      setMediaItems(data || []);
      setMediaLoaded(true);
    } catch {} finally { setMediaLoading(false); }
  }

  async function handleFollow() {
    if (!me) return;
    setActionLoading(true);
    try {
      const res = await followApi.toggle(uid);
      // res.followerCount is the new count for the target user
      setFollowData(res);
      setProfile(prev => prev ? { ...prev, followerCount: res.followerCount } : prev);
    } catch {} finally { setActionLoading(false); }
  }

  async function handleFriend() {
    if (!me || isMe) return;
    setActionLoading(true);
    try {
      const { status } = relationship;
      if (status === 'NONE') {
        const res = await friendApi.sendRequest(uid);
        setRelationship({ status: res.status || 'REQUEST_SENT' });
      } else if (status === 'REQUEST_RECEIVED') {
        const res = await friendApi.respond(relationship.requestId, 'ACCEPT');
        setRelationship({ ...relationship, status: res.status });
      } else if (status === 'FRIENDS' || status === 'REQUEST_SENT') {
        await friendApi.unfriend(uid);
        setRelationship({ status: 'NONE' });
      }
    } catch {} finally { setActionLoading(false); }
  }

  async function handleVote(postId, voteType) {
    if (!requireAccount('like or dislike posts')) return;
    try {
      const u = await api.votePost(postId, voteType);
      setPosts(prev => prev.map(p => p.id === postId ? u : p));
    } catch {}
  }

  // pending delete confirmation — { postId, admin } or null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  function handleDelete(postId) {
    setDeleteError('');
    setDeleteTarget({ postId, admin: false });
  }

  function handleAdminDelete(postId) {
    setDeleteError('');
    setDeleteTarget({ postId, admin: true });
  }

  async function confirmDeletePost() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      if (deleteTarget.admin) await adminApi.deletePost(deleteTarget.postId);
      else await api.deletePost(deleteTarget.postId);
      setPosts(prev => prev.filter(p => p.id !== deleteTarget.postId));
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete post.');
    } finally {
      setDeleting(false);
    }
  }

  function friendBtnLabel() {
    switch (relationship.status) {
      case 'FRIENDS':          return '✓ Friends';
      case 'REQUEST_SENT':     return '⏳ Pending';
      case 'REQUEST_RECEIVED': return '✅ Accept';
      default:                 return '+ Add Friend';
    }
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  if (!profile) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>User not found</div>;

  const banner = bannerSrc(profile.bannerPicture);
  const avatar = avatarSrc(profile.profilePicture);

  return (
    <div className="main-content" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>

        {/* Back */}
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 0 4px', padding: '6px 0' }}>
          ← Back
        </button>

        {/* Banner — full width, YouTube-style */}
        <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginTop: 8, background: banner ? undefined : 'linear-gradient(135deg,#1a3a5c,#0f2040)' }}>
          {banner && <img src={banner} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </div>

        {/* Header row: avatar overlapping banner, info, action buttons — like a channel header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, marginTop: -48 }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0, border: '4px solid var(--bg-body)', borderRadius: '50%', background: 'var(--bg-body)', zIndex: 2 }}>
            {avatar
              ? <img src={avatar} alt={profile.username} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 700, color: '#fff' }}>{(profile.displayName || profile.username || '?').slice(0, 2).toUpperCase()}</div>
            }
          </div>

          {/* Info column */}
          <div style={{ flex: 1, minWidth: 240, paddingTop: 56 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{profile.displayName || profile.username}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>@{profile.username}</span>
              <span>·</span>
              <span>{(followData.followerCount ?? profile.followerCount ?? 0).toLocaleString()} followers</span>
              <span>·</span>
              <span>Joined {fmtJoin(profile.createdAt)}</span>
            </div>
            {profile.bio && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 8, marginBottom: 0, maxWidth: 640, whiteSpace: 'pre-wrap' }}>
                {bioIsLong ? bioPreview : profile.bio}
                {bioIsLong && (
                  <>
                    …{' '}
                    <span onClick={() => setShowAbout(true)}
                      style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
                      more
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Action buttons — Subscribe/Join-style pills */}
          {!isMe && (
            <div style={{ display: 'flex', gap: 10, paddingTop: 56, flexShrink: 0 }}>
              <button onClick={handleFollow} disabled={actionLoading}
                style={{ padding: '10px 24px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: followData.following ? 'var(--bg-hover)' : 'var(--text-primary)',
                  border: followData.following ? '1px solid var(--border-input)' : 'none',
                  color: followData.following ? 'var(--text-secondary)' : 'var(--bg-body)' }}>
                {followData.following ? '✓ Following' : 'Follow'}
              </button>
              <button onClick={handleFriend} disabled={actionLoading}
                style={{ padding: '10px 24px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: relationship.status === 'FRIENDS' ? 'var(--bg-hover)' : relationship.status === 'REQUEST_RECEIVED' ? '#4caf50' : 'var(--bg-hover)',
                  border: '1px solid var(--border-input)',
                  color: relationship.status === 'REQUEST_RECEIVED' ? '#fff' : 'var(--text-primary)' }}>
                {friendBtnLabel()}
              </button>
            </div>
          )}
        </div>

        {/* Tabs — full-width underline nav like a channel's Home/Videos/Posts row */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginTop: 28, gap: 8 }}>
          {['posts','media','clips'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'media' || tab === 'clips') loadMedia(); }}
              style={{ padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--text-primary)' : 'transparent'}`,
                marginBottom: -1, textTransform: 'capitalize', transition: 'all 0.15s' }}>
              {tab === 'posts' ? 'Posts' : tab === 'media' ? 'Media' : 'Clips'}
            </button>
          ))}
        </div>

        {/* Feed content */}
        <div style={activeTab === 'posts'
          ? { maxWidth: 900, margin: '16px 0 0' }
          : { maxWidth: 900, margin: '16px auto 0' }}>
          {activeTab === 'posts' ? (
            postsLoading && postsPage === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading posts…</div>
            ) : posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)', opacity: 0.35 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                <div style={{ fontWeight: 600 }}>No posts yet</div>
              </div>
            ) : (
              <>
                {posts.map(p => (
                  <div key={p.id} style={{ marginBottom: 12 }}>
                    <PostCard post={p} userId={me?.id} isAdmin={!!me?.admin} onVote={handleVote} onOpenComments={setComments} onDelete={handleDelete} onAdminDelete={handleAdminDelete} onNavigatePost={id => navigate(`/post/${id}`)} />
                  </div>
                ))}
                {hasMore && (
                  <button onClick={() => loadPosts(postsPage + 1)} disabled={postsLoading} style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, marginBottom: 24 }}>
                    {postsLoading ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </>
            )
          ) : activeTab === 'media' ? (
            /* Media tab */
            mediaLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading media…</div>
            ) : videosOnly.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)', opacity: 0.35 }}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                <div style={{ fontWeight: 600 }}>No media yet</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px 12px', marginBottom: 24 }}>
                {videosOnly.map(item => {
                  const thumb = item.thumbnailUrl ? resolveUrl(item.thumbnailUrl.startsWith('http') ? item.thumbnailUrl : `${API_BASE}${item.thumbnailUrl}`) : null;
                  const videoSrc = !thumb && item.videoUrl ? resolveUrl(item.videoUrl.startsWith('http') ? item.videoUrl : `${API_BASE}${item.videoUrl}`) : null;
                  const duration = fmtDuration(item.duration ?? item.durationSeconds ?? item.lengthSeconds);
                  const views = item.viewCount ?? item.views ?? 0;
                  const placeholder = (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                      <svg viewBox="0 0 24 24" fill="white" width="22" height="22"><polygon points="5,3 19,12 5,21"/></svg>
                    </div>
                  );
                  return (
                    <div key={item.id} onClick={() => navigate('/media')} style={{ cursor: 'pointer' }}>
                      {/* Thumbnail */}
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-hover)' }}>
                        {thumb
                          ? <img src={thumb} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <AutoFrameThumb src={videoSrc} alt={item.title} placeholder={placeholder} />}
                        {duration && (
                          <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 5px', borderRadius: 4, lineHeight: 1.3 }}>
                            {duration}
                          </span>
                        )}
                      </div>
                      {/* Title + meta */}
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                          {fmtViews(views)} views{item.createdAt ? ` · ${fmtAgo(item.createdAt)}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Clips tab — 6 per row, vertical (9:16) tiles */
            mediaLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading clips…</div>
            ) : clipsOnly.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)', opacity: 0.35 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <div style={{ fontWeight: 600 }}>No clips yet</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {clipsOnly.map(item => {
                  const thumb = item.thumbnailUrl ? resolveUrl(item.thumbnailUrl.startsWith('http') ? item.thumbnailUrl : `${API_BASE}${item.thumbnailUrl}`) : null;
                  const videoSrc = !thumb && item.videoUrl ? resolveUrl(item.videoUrl.startsWith('http') ? item.videoUrl : `${API_BASE}${item.videoUrl}`) : null;
                  const duration = fmtDuration(item.duration ?? item.durationSeconds ?? item.lengthSeconds);
                  const views = item.viewCount ?? item.views ?? 0;
                  const placeholder = (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="white" width="20" height="20"><polygon points="5,3 19,12 5,21"/></svg>
                    </div>
                  );
                  return (
                    <div key={item.id} onClick={() => navigate('/media')} style={{ cursor: 'pointer' }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-hover)' }}>
                        {thumb
                          ? <img src={thumb} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <AutoFrameThumb src={videoSrc} alt={item.title} placeholder={placeholder} />}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.05) 45%, transparent 100%)' }} />
                        {duration && (
                          <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace' }}>
                            {duration}
                          </span>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 8px 7px' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                            {fmtViews(views)} views
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
      {comments !== null && <CommentsPanel type="post" targetId={comments} onClose={() => setComments(null)} />}
      {showAbout && (
        <div onClick={() => setShowAbout(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{profile.displayName || profile.username}</div>
              <button onClick={() => setShowAbout(false)}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {profile.bio && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Description</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 0, marginBottom: 24 }}>{profile.bio}</p>
              </>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>More info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ flexShrink: 0, color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Joined {fmtJoin(profile.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ flexShrink: 0, color: 'var(--text-muted)' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>{(followData.followerCount ?? profile.followerCount ?? 0).toLocaleString()} followers</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <ConfirmModal
          title={deleteTarget.admin ? 'Delete post as admin?' : 'Delete this post?'}
          message={deleteTarget.admin
            ? "This bypasses ownership and can't be undone."
            : "This can't be undone."}
          confirmLabel="Delete"
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDeletePost}
          confirming={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
