import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRequireAccount } from '../hooks/useRequireAccount';
import { api, API_BASE, followApi } from '../services/api';
import CommentsPanel from '../components/CommentsPanel';
import UserAvatar from '../components/UserAvatar';
import MarkdownRenderer from '../components/MarkdownRenderer';
import RightSidebar from '../components/layout/RightSidebar';

function avatarUrl(pic) { if (!pic) return null; return pic.startsWith('http') ? pic : `${API_BASE}${pic}`; }
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
const LikeIcon    = ({ active }) => <svg viewBox="0 0 24 24" fill={active ? 'var(--accent)' : 'none'} stroke={active ? 'var(--accent)' : 'currentColor'} strokeWidth="2" width="16" height="16"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
const DislikeIcon = ({ active }) => <svg viewBox="0 0 24 24" fill={active ? '#e06060' : 'none'} stroke={active ? '#e06060' : 'currentColor'} strokeWidth="2" width="16" height="16"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>;
const CommentIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const BackIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><polyline points="15 18 9 12 15 6"/></svg>;
const ChevronIcon = ({ up }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>;

function MediaCarousel({ items }) {
  const [idx, setIdx] = useState(0);
  if (!items || items.length === 0) return null;
  const current = items[idx];
  const src = current.mediaUrl ? (current.mediaUrl.startsWith('http') ? current.mediaUrl : `${API_BASE}${current.mediaUrl}`) : null;
  if (!src) return null;
  return (
    <div className="omni-page-enter" style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      {current.mediaType === 'VIDEO'
        ? <video src={src} controls style={{ width: '100%', maxHeight: 480, display: 'block' }} />
        : <img src={src} alt="" style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }} />
      }
      {items.length > 1 && (
        <>
          {idx > 0 && <button onClick={() => setIdx(i => i - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }}>&#8249;</button>}
          {idx < items.length - 1 && <button onClick={() => setIdx(i => i + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }}>&#8250;</button>}
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
            {items.map((_, i) => <div key={i} onClick={() => setIdx(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer' }} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function PostDetailPage() {
  const { slug }     = useParams();
  const { user: me } = useAuth();
  const requireAccount = useRequireAccount();
  const navigate     = useNavigate();
  const [post,          setPost]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [followData,    setFollowData]    = useState({ following: false });
  const [followLoading, setFollowLoading] = useState(false);
  const [commentsOpen,  setCommentsOpen]  = useState(true);
  const isOwn = me?.id === post?.authorId;
  useEffect(() => {
    setLoading(true);
    api.getPostBySlug(slug)
      .then(found => {
        setPost(found);
        if (me && me.id !== found.authorId)
          followApi.status(found.authorId, me.id).then(f => setFollowData(f)).catch(() => {});
      }).catch(() => setPost(null)).finally(() => setLoading(false));
  }, [slug, me?.id]);

  async function handleFollow() {
    if (!me || !post || isOwn) return;
    setFollowLoading(true);
    try { const res = await followApi.toggle(post.authorId); setFollowData(res); }
    catch {} finally { setFollowLoading(false); }
  }

  async function handleVote(type) {
    if (!post) return;
    if (!requireAccount('like or dislike posts')) return;
    try { const u = await api.votePost(post.id, type); setPost(u); } catch {}
  }

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', height:'100%' }}>Loading…</div>;
  if (!post)   return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'var(--text-muted)', height:'100%' }}>
      <div style={{ fontSize:36 }}>🔍</div><div>Post not found</div>
      <button onClick={() => navigate(-1)} style={{ background:'var(--accent)', border:'none', color:'var(--accent-text)', padding:'8px 20px', borderRadius:20, cursor:'pointer', fontWeight:700 }}>Go Back</button>
    </div>
  );

  const aSrc = avatarUrl(post.authorAvatar);
  const mediaItems = post.mediaItems && post.mediaItems.length > 0
    ? post.mediaItems
    : post.mediaUrl ? [{ mediaUrl: post.mediaUrl, mediaType: post.mediaType }] : [];

  return (
    <div className="post-detail-page">
      {/* ── POST COLUMN ── */}
      <div className="post-detail-content">
        <button onClick={() => navigate(-1)} className="post-detail-back">
          <BackIcon /> Back
        </button>
        <div className="post-detail-body">
          {/* Author */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <UserAvatar src={post.authorAvatar} name={post.authorDisplayName || post.authorUsername} userId={post.authorId} size={44} onClick={() => navigate(`/profile/${post.authorUsername}`)} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', cursor:'pointer' }} onClick={() => navigate(`/profile/${post.authorUsername}`)}>
                {post.authorDisplayName || post.authorUsername}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>@{post.authorUsername} · {fmtTime(post.createdAt)}</div>
            </div>
            {!isOwn && me && (
              <button onClick={handleFollow} disabled={followLoading} style={{ padding:'7px 18px', borderRadius:20, fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0, background: followData.following ? 'var(--bg-hover)' : 'var(--accent)', color: followData.following ? 'var(--text-secondary)' : '#fff', border: followData.following ? '1px solid var(--border-input)' : '1px solid var(--accent)' }}>
                {followData.following ? '✓ Following' : 'Follow'}
              </button>
            )}
          </div>

          {post.title   && <h2 style={{ fontSize:16, fontWeight:800, fontFamily:"'Manrope', sans-serif", color:'var(--text-primary)', marginBottom:10, lineHeight:1.2 }}>{post.title}</h2>}
          {post.content && <div style={{ fontSize:15, color:'var(--text-primary)', lineHeight:1.75, marginBottom: mediaItems.length ? 16 : 20 }}><MarkdownRenderer text={post.content} /></div>}

          <MediaCarousel items={mediaItems} />

          {/* Actions */}
          <div style={{ display:'flex', gap:8, paddingTop:16, borderTop:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center' }}>
            <button onClick={() => handleVote('LIKE')} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', background: post.userVote==='LIKE' ? 'rgba(79,172,254,0.12)' : 'var(--bg-hover)', border:`1px solid ${post.userVote==='LIKE' ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius:20, color: post.userVote==='LIKE' ? 'var(--accent)' : 'var(--text-muted)', cursor:'pointer', fontSize:13, fontWeight:500 }}>
              <LikeIcon active={post.userVote==='LIKE'} /> {post.likeCount > 0 ? post.likeCount : 'Like'}
            </button>
            <button onClick={() => handleVote('DISLIKE')} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', background: post.userVote==='DISLIKE' ? 'rgba(224,96,96,0.08)' : 'var(--bg-hover)', border:`1px solid ${post.userVote==='DISLIKE' ? '#e06060' : 'var(--border-input)'}`, borderRadius:20, color: post.userVote==='DISLIKE' ? '#e06060' : 'var(--text-muted)', cursor:'pointer', fontSize:13, fontWeight:500 }}>
              <DislikeIcon active={post.userVote==='DISLIKE'} /> {post.dislikeCount > 0 && post.dislikeCount}
            </button>
            <button onClick={() => setCommentsOpen(o => !o)} className="post-detail-comments-toggle">
              <CommentIcon />
              <span>{commentsOpen ? 'Hide' : `Comments${post.commentCount > 0 ? ` (${post.commentCount})` : ''}`}</span>
              <ChevronIcon up={commentsOpen} />
            </button>
          </div>

          {/* Comments — now always rendered at the bottom, full width */}
          {commentsOpen && (
            <div className="post-detail-comments-bottom">
              <CommentsPanel type="post" targetId={post.id} inline={true} />
            </div>
          )}
        </div>
      </div>

      <RightSidebar />
    </div>
  );
}
