import React, { useState, useEffect, useCallback, useRef } from 'react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRequireAccount } from '../hooks/useRequireAccount';
import { api, adminApi, API_BASE, followApi, resolveUrl } from '../services/api';
import CommentsPanel from '../components/CommentsPanel';
import UserAvatar from '../components/UserAvatar';
import ConfirmModal from '../components/ConfirmModal';
import RightSidebar from '../components/layout/RightSidebar';

/* ── Icons ── */
const LikeIcon    = ({ active }) => <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
const DislikeIcon = ({ active }) => <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>;
const CommentIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const OpenIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
const DotsIcon    = () => <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>;
const SparkleIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;

/* ── Post menu ── */
function PostMenu({ onDelete, onAdminDelete, onNavigatePost, postId, postSlug, isOwn, isAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const menuItems = [
    { label: 'Open post',  icon: <OpenIcon />, onClick: () => { setOpen(false); onNavigatePost(postSlug); } },
    { label: 'Copy link',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, onClick: () => { setOpen(false); navigator.clipboard?.writeText(`${window.location.origin}/post/${postSlug}`); } },
    ...(isOwn ? [
      { label: 'Edit post',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, onClick: () => { setOpen(false); onNavigatePost(postSlug); } },
    ] : []),
    { divider: true },
    ...(isOwn ? [
      { label: 'Delete post', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>, onClick: () => { setOpen(false); onDelete(postId); }, danger: true },
    ] : []),
    ...(isAdmin && !isOwn ? [
      { label: 'Delete post (admin)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, onClick: () => { setOpen(false); onAdminDelete(postId); }, danger: true },
    ] : []),
  ];

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="omni-dots-btn"
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="omni-post-menu" onClick={e => e.stopPropagation()}>
          {menuItems.map((item, i) =>
            item.divider
              ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
              : (
                <button
                  key={i}
                  onClick={item.onClick}
                  className={`omni-post-menu-item${item.danger ? ' danger' : ''}`}
                >
                  <span className="menu-icon">{item.icon}</span>
                  {item.label}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
      {isTruncated && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>…more</span>}
    </div>
  );
}

/* ── Post Card ── */
function PostCard({ post, onVote, onOpenComments, onDelete, onAdminDelete, userId, isAdmin, onNavigateProfile, onNavigatePost, followMap, onFollow }) {
  const isOwn = post.authorId === userId;
  const [mediaIdx, setMediaIdx] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  const mediaItems = post.mediaItems?.length > 0
    ? post.mediaItems.map(m => ({ src: resolveUrl(m.mediaUrl.startsWith('http') ? m.mediaUrl : `${API_BASE}${m.mediaUrl}`), type: m.mediaType }))
    : post.mediaUrl
      ? [{ src: resolveUrl(post.mediaUrl.startsWith('http') ? post.mediaUrl : `${API_BASE}${post.mediaUrl}`), type: post.mediaType }]
      : [];

  const followChecked = post.authorId in (followMap || {});
  const following     = followMap?.[post.authorId] ?? false;

  async function handleFollow(e) {
    e.stopPropagation();
    if (!userId || isOwn) return;
    setFollowLoading(true);
    try {
      const res = await followApi.toggle(post.authorId);
      onFollow?.(post.authorId, res.following);
    } catch {} finally { setFollowLoading(false); }
  }

  const likeActive = post.userVote === 'LIKE';
  const dislikeActive = post.userVote === 'DISLIKE';

  return (
    <article
      className="omni-post-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Author row */}
      <div className="omni-post-author-row">
        <div className="omni-avatar-wrap" onClick={() => onNavigateProfile(post.authorUsername)}>
          <UserAvatar
            src={post.authorAvatar}
            name={post.authorDisplayName || post.authorUsername}
            userId={post.authorId}
            size={36}
          />
        </div>
        <div className="omni-post-meta">
          <span className="omni-display-name">{post.authorDisplayName || post.authorUsername}</span>
          <span className="omni-username-time">@{post.authorUsername} · {fmtTime(post.createdAt)}</span>
        </div>

        {!isOwn && userId && followChecked && (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`omni-follow-btn${following ? ' following' : ''}`}
          >
            {following ? 'Following' : '+ Follow'}
          </button>
        )}
        {(isOwn || isAdmin) && (
          <PostMenu
            postId={post.id}
            postSlug={post.slug}
            onDelete={onDelete}
            onAdminDelete={onAdminDelete}
            onNavigatePost={onNavigatePost}
            isOwn={isOwn}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Clickable body */}
      <div className="omni-post-body" onClick={() => onNavigatePost(post.slug)}>
        {post.title && <h2 className="omni-post-title">{post.title}</h2>}
        {post.content && (
          <div className={`omni-post-content${mediaItems.length ? ' has-media' : ''}`}>
            <PostContent content={post.content} />
          </div>
        )}

        {mediaItems.length > 0 && (
          <div className="omni-media-wrap" onClick={e => e.stopPropagation()}>
            {mediaItems[mediaIdx].type === 'VIDEO'
              ? <video src={mediaItems[mediaIdx].src} controls className="omni-media-item" />
              : <img src={mediaItems[mediaIdx].src} alt="" className="omni-media-item" />}

            {mediaIdx > 0 && (
              <button className="omni-media-arrow left" onClick={() => setMediaIdx(i => i - 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {mediaIdx < mediaItems.length - 1 && (
              <button className="omni-media-arrow right" onClick={() => setMediaIdx(i => i + 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            {mediaItems.length > 1 && (
              <>
                <span className="omni-media-counter">{mediaIdx + 1}/{mediaItems.length}</span>
                <div className="omni-media-dots">
                  {mediaItems.map((_, i) => (
                    <button key={i} onClick={() => setMediaIdx(i)} className={`omni-media-dot${i === mediaIdx ? ' active' : ''}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="omni-post-actions">
        <button
          onClick={e => { onVote(post.id, 'LIKE'); const b=e.currentTarget; b.classList.add('pop'); b.addEventListener('animationend',()=>b.classList.remove('pop'),{once:true}); }}
          className={`omni-action-btn like${likeActive ? ' active' : ''}`}
        >
          <LikeIcon active={likeActive} />
          <span>{post.likeCount > 0 ? post.likeCount : 'Like'}</span>
        </button>
        <button
          onClick={e => { onVote(post.id, 'DISLIKE'); const b=e.currentTarget; b.classList.add('pop'); b.addEventListener('animationend',()=>b.classList.remove('pop'),{once:true}); }}
          className={`omni-action-btn dislike${dislikeActive ? ' active' : ''}`}
        >
          <DislikeIcon active={dislikeActive} />
          {post.dislikeCount > 0 && <span>{post.dislikeCount}</span>}
        </button>
        <button onClick={() => onOpenComments(post.id)} className="omni-action-btn comment">
          <CommentIcon />
          <span>{post.commentCount > 0 ? post.commentCount : 'Comment'}</span>
        </button>
        <button onClick={() => onNavigatePost(post.slug)} className="omni-action-btn open" style={{ marginLeft: 'auto' }}>
          <OpenIcon />
          <span>Open</span>
        </button>
      </div>
    </article>
  );
}

/* ── Skeleton loader ── */
function PostSkeleton() {
  return (
    <div className="omni-post-skeleton">
      <div className="skel-row">
        <div className="skel skel-avatar" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skel" style={{ width: '40%', height: 12, borderRadius: 6 }} />
          <div className="skel" style={{ width: '25%', height: 10, borderRadius: 6 }} />
        </div>
      </div>
      <div className="skel" style={{ width: '70%', height: 16, borderRadius: 6, marginBottom: 8 }} />
      <div className="skel" style={{ width: '100%', height: 11, borderRadius: 6, marginBottom: 5 }} />
      <div className="skel" style={{ width: '85%', height: 11, borderRadius: 6 }} />
    </div>
  );
}

/* ── Feed header ── */
function FeedHeader({ onRefresh, loading }) {
  return (
    <div className="omni-feed-header">
      <div className="omni-feed-title">
        <SparkleIcon />
        <span>For you</span>
      </div>
      <button
        className="omni-refresh-btn"
        onClick={onRefresh}
        disabled={loading}
        title="Refresh feed"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"
          style={{ transition: 'transform 0.5s', transform: loading ? 'rotate(360deg)' : 'none' }}>
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    </div>
  );
}

/* ── Home ── */
export default function Home() {
  const { user } = useAuth();
  const requireAccount = useRequireAccount();
  const navigate = useNavigate();
  const [posts,     setPosts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(0);
  const [hasMore,   setHasMore]   = useState(true);
  const [comments,  setComments]  = useState(null);
  const [followMap, setFollowMap] = useState({});

  function handleFollow(authorId, isFollowing) {
    setFollowMap(prev => ({ ...prev, [authorId]: isFollowing }));
  }

  const loadPosts = useCallback(async (pg = 0) => {
    try {
      setLoading(true);
      const data = await api.getPosts(pg, user?.id);
      setPosts(prev => pg === 0 ? data : [...prev, ...data]);
      setHasMore(data.length === 20);
      setPage(pg);
      if (user?.id) {
        const authorIds = [...new Set(data.map(p => p.authorId).filter(id => id !== user.id))];
        authorIds.forEach(authorId => {
          followApi.status(authorId, user.id)
            .then(f => setFollowMap(prev => ({ ...prev, [authorId]: f.following })))
            .catch(() => {});
        });
      }
    } catch {} finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { loadPosts(0); }, [loadPosts]);

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

  return (
    <div className="omni-home-root omni-page-enter">
      <style>{HOME_STYLES}</style>

      <div className="omni-home-layout">
      <div className="omni-feed-wrap">
        <FeedHeader onRefresh={() => loadPosts(0)} loading={loading} />

        {loading && page === 0 ? (
          <div className="omni-skeleton-list">
            {[1, 2, 3].map(n => <PostSkeleton key={n} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="omni-empty-state">
            <div className="omni-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="36" height="36">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </div>
            <p className="omni-empty-title">Nothing here yet</p>
            <p className="omni-empty-sub">Follow people or be the first to post.</p>
          </div>
        ) : (
          <>
            {posts.map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                userId={user?.id}
                isAdmin={!!user?.admin}
                onVote={handleVote}
                onOpenComments={setComments}
                onDelete={handleDelete}
                onAdminDelete={handleAdminDelete}
                onNavigateProfile={id => navigate(`/profile/${id}`)}
                onNavigatePost={id => navigate(`/post/${id}`)}
                followMap={followMap}
                onFollow={handleFollow}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => loadPosts(page + 1)}
                disabled={loading}
                className="omni-load-more"
              >
                {loading ? (
                  <span className="omni-load-spinner" />
                ) : (
                  'Load more posts'
                )}
              </button>
            )}
          </>
        )}
      </div>
      <RightSidebar />
      </div>

      {comments !== null && (
        <CommentsPanel type="post" targetId={comments} onClose={() => setComments(null)} />
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

/* ── Styles ── */
const HOME_STYLES = `
  .omni-home-root {
    height: 100%;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .omni-home-layout {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 12px;
  }

  .omni-feed-wrap {
    padding: 0 0 48px 0;
    width: 100%;
    max-width: 640px;
    min-width: 0;
  }

  /* ── Feed header ── */
  .omni-feed-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 4px 20px;
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-body);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .omni-feed-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .omni-feed-title svg {
    color: var(--accent);
  }

  .omni-refresh-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: transparent;
    border: 1px solid var(--border-input);
    border-radius: 20px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .omni-refresh-btn:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .omni-refresh-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* ── Post card ── */
  .omni-post-card {
    padding: 18px 20px 14px 20px;
    border-bottom: 1px solid var(--border);
    transition: background 0.12s;
    position: relative;
  }

  .omni-post-card:hover {
    background: var(--bg-hover);
  }

  /* ── Author row ── */
  .omni-post-author-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .omni-avatar-wrap {
    cursor: pointer;
    flex-shrink: 0;
    border-radius: 50%;
    transition: opacity 0.15s;
  }

  .omni-avatar-wrap:hover {
    opacity: 0.8;
  }

  .omni-post-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .omni-display-name {
    font-size: 13.5px;
    font-weight: 650;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .omni-username-time {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Follow button ── */
  .omni-follow-btn {
    padding: 4px 13px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    letter-spacing: -0.01em;
  }

  .omni-follow-btn.following {
    background: transparent;
    color: var(--text-muted);
    border-color: var(--border-input);
  }

  .omni-follow-btn:hover:not(:disabled) {
    opacity: 0.8;
  }

  /* ── 3-dot menu ── */
  .omni-dots-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 5px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: color 0.12s, background 0.12s;
  }

  .omni-dots-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .omni-post-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.24);
    min-width: 160px;
    z-index: 100;
    overflow: hidden;
    animation: omni-menu-in 0.1s ease;
  }

  @keyframes omni-menu-in {
    from { opacity: 0; transform: translateY(-5px) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }

  .omni-post-menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 13px;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    letter-spacing: -0.01em;
  }

  .omni-post-menu-item.danger { color: #e06060; }
  .omni-post-menu-item .menu-icon { color: var(--text-muted); display: flex; }
  .omni-post-menu-item.danger .menu-icon { color: #e06060; }
  .omni-post-menu-item:hover { background: var(--bg-hover); }

  /* ── Post body ── */
  .omni-post-body {
    cursor: pointer;
  }

  .omni-post-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 6px;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }

  .omni-post-content {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.55;
    margin-bottom: 0;
  }

  .omni-post-content.has-media {
    margin-bottom: 10px;
  }

  /* ── Media ── */
  .omni-media-wrap {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: #000;
    aspect-ratio: 16/9;
    margin-top: 10px;
    margin-bottom: 4px;
    border: 1px solid var(--border);
  }

  .omni-media-item {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .omni-media-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0,0,0,0.6);
    border: none;
    color: #fff;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: background 0.15s;
  }

  .omni-media-arrow:hover { background: rgba(0,0,0,0.85); }
  .omni-media-arrow.left  { left: 10px; }
  .omni-media-arrow.right { right: 10px; }

  .omni-media-counter {
    position: absolute;
    bottom: 8px;
    right: 10px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    z-index: 2;
  }

  .omni-media-dots {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    z-index: 2;
  }

  .omni-media-dot {
    width: 6px;
    height: 6px;
    border-radius: 3px;
    padding: 0;
    border: none;
    cursor: pointer;
    background: rgba(255,255,255,0.4);
    transition: width 0.2s, background 0.2s;
  }

  .omni-media-dot.active {
    width: 16px;
    background: #fff;
  }

  /* ── Action bar ── */
  .omni-post-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }

  .omni-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    transition: color 0.12s, background 0.12s, border-color 0.12s;
    letter-spacing: -0.01em;
  }

  .omni-action-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-input);
  }

  .omni-action-btn.like.active {
    color: var(--accent);
    background: rgba(168,85,247,0.08);
    border-color: var(--accent);
  }

  .omni-action-btn.dislike.active {
    color: #e06060;
    background: rgba(224,96,96,0.08);
    border-color: #e06060;
  }

  /* ── Skeleton ── */
  .omni-post-skeleton {
    padding: 18px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .skel-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .skel {
    background: var(--bg-hover);
    animation: omni-pulse 1.4s ease-in-out infinite;
  }

  .skel-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  @keyframes omni-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  /* ── Empty state ── */
  .omni-empty-state {
    text-align: center;
    padding: 64px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .omni-empty-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .omni-empty-title {
    font-size: 15px;
    font-weight: 650;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .omni-empty-sub {
    font-size: 13px;
    color: var(--text-muted);
  }

  /* ── Load more ── */
  .omni-load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    background: transparent;
    border: none;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    letter-spacing: -0.01em;
  }

  .omni-load-more:hover:not(:disabled) {
    color: var(--accent);
    background: var(--bg-hover);
  }

  .omni-load-more:disabled {
    cursor: default;
  }

  .omni-load-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-input);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: omni-spin 0.7s linear infinite;
    display: inline-block;
  }

  @keyframes omni-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Mobile ── */
  @media (max-width: 600px) {
    .omni-feed-wrap {
      padding-bottom: 80px;
    }
    .omni-post-card {
      padding: 14px 16px 12px 16px;
    }
    .omni-feed-header {
      padding: 14px 16px 10px 16px;
    }
  }
`;
