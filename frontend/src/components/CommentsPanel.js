import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, adminApi, API_BASE, replyApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRequireAccount } from '../hooks/useRequireAccount';
import UserAvatar from './UserAvatar';

/* ── SVG Icons ── */
const LikeIcon    = ({a}) => <svg viewBox="0 0 24 24" fill={a?'var(--accent)':'none'} stroke={a?'var(--accent)':'currentColor'} strokeWidth="2" width="13" height="13"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
const DislikeIcon = ({a}) => <svg viewBox="0 0 24 24" fill={a?'#e06060':'none'} stroke={a?'#e06060':'currentColor'} strokeWidth="2" width="13" height="13"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>;
const ReplyIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>;
const EmojiIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
const SendIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const CloseIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const DotsIcon    = () => <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>;
const EditIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;

const EMOJIS = [
  ['👍','❤️','😂','😮','😢','😡'],
  ['🔥','🎉','👀','💯','🤔','😍'],
  ['👏','🙏','💪','🥳','😭','🤣'],
];

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* Emoji picker — closes on outside-click */
function EmojiPicker({ onPick, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: 'absolute', bottom: '110%', left: 0, background: 'var(--bg-menu)', border: '1px solid var(--border-input)', borderRadius: 14, padding: '10px 12px', boxShadow: '0 8px 28px rgba(0,0,0,0.4)', zIndex: 300, width: 190 }}>
      {EMOJIS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 2, marginBottom: ri < EMOJIS.length - 1 ? 4 : 0 }}>
          {row.map(e => (
            <button key={e} onClick={() => { onPick(e); onClose(); }}
              style={{ background: 'none', border: 'none', fontSize: 19, cursor: 'pointer', padding: '3px 4px', borderRadius: 6, lineHeight: 1 }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>
              {e}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* Delete confirmation dialog */
function DeleteConfirm({ onConfirm, onCancel, title = 'Delete comment?', subtitle = "This can't be undone." }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-card)', border: '1px solid var(--border-input)', borderRadius: 16, padding: '24px 28px', zIndex: 901, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', width: 300, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{subtitle}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid var(--border-input)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: '#e06060', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </>
  );
}

/* 3-dot context menu */
function DotsMenu({ isOwn, isAdmin, onEdit, onReply, onDelete, onAdminDelete, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);

  const item = (icon, label, action, color) => (
    <button onClick={() => { action(); onClose(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: color || 'var(--text-primary)', borderRadius: 8, textAlign: 'left' }}
      onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>
      {icon} {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'absolute', bottom: '110%', right: 0, background: 'var(--bg-menu)', border: '1px solid var(--border-input)', borderRadius: 12, padding: '6px', boxShadow: '0 8px 28px rgba(0,0,0,0.35)', zIndex: 300, minWidth: 150 }}>
      {item(<ReplyIcon />, 'Reply', onReply)}
      {isOwn && item(<EditIcon />, 'Edit', onEdit)}
      {isOwn && item(<TrashIcon />, 'Delete', onDelete, '#e06060')}
      {isAdmin && !isOwn && item(<TrashIcon />, 'Delete (admin)', onAdminDelete, '#e06060')}
    </div>
  );
}

/* ── Single comment / reply row ── */
function CommentRow({ comment: initComment, onDeleteTop, viewerId, isAdmin, depth = 0, openPickerId, setOpenPickerId, openReplyId, setOpenReplyId, onMentionReply }) {
  const [comment,     setComment]     = useState(initComment);
  const [replies,     setReplies]     = useState([]);
  const [loaded,      setLoaded]      = useState(false);
  const [replyText,   setReplyText]   = useState('');
  const [editing,     setEditing]     = useState(false);
  const [editText,    setEditText]    = useState(comment.content);
  const [showDots,    setShowDots]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [confirmAdminDel, setConfirmAdminDel] = useState(false);
  const replyRef = useRef();
  const editRef  = useRef();
  const requireAccount = useRequireAccount();

  const isPickerOpen = openPickerId === comment.id;
  const isReplyOpen  = openReplyId  === comment.id;
  const name  = comment.authorDisplayName || comment.authorUsername;
  const isOwn = viewerId === comment.authorId;
  const sortedReactions = Object.entries(comment.reactions || {}).sort((a, b) => b[1] - a[1]);

  async function loadReplies() {
    if (loaded) return;
    try { const r = await replyApi.getReplies(comment.id, viewerId); setReplies(r); setLoaded(true); }
    catch {}
  }

  function toggleReplies() {
    if (!isReplyOpen) { loadReplies(); setOpenReplyId(comment.id); }
    else { setOpenReplyId(null); }
  }
  function togglePicker(e) {
    e.stopPropagation();
    setOpenPickerId(isPickerOpen ? null : comment.id);
  }

  async function vote(voteType) {
    if (!requireAccount('like or dislike comments')) return;
    try { const u = await api.voteComment(comment.id, voteType); setComment(u); } catch {}
  }
  async function react(emoji) {
    if (!requireAccount('react to comments')) return;
    try { const u = await api.reactComment(comment.id, emoji); setComment(u); } catch {}
  }

  async function submitReply() {
    const t = replyText.trim(); if (!t) return;
    if (!requireAccount('reply to comments')) return;
    try {
      const r = await replyApi.addReply(comment.id, t);
      setReplies(prev => [...prev, r]);
      setLoaded(true);
      setComment(prev => ({ ...prev, replyCount: (prev.replyCount || 0) + 1 }));
      setReplyText('');
    } catch {}
  }

  async function submitEdit() {
    const t = editText.trim(); if (!t) return;
    try {
      // Use comment vote endpoint with EDIT action — or directly patch via api
      // We'll call the update endpoint if it exists, otherwise optimistic UI
      setComment(prev => ({ ...prev, content: t }));
      setEditing(false);
      // TODO: wire to backend PATCH /comments/{id} when added
    } catch {}
  }

  // Called from DotsMenu "Reply" — pre-fills @username in parent's reply input
  function handleMenuReply() {
    if (depth === 0) {
      // open reply section and prefill @mention
      loadReplies();
      setOpenReplyId(comment.id);
      setTimeout(() => {
        setReplyText(`@${comment.authorUsername} `);
        replyRef.current?.focus();
      }, 100);
    } else if (onMentionReply) {
      onMentionReply(`@${comment.authorUsername} `);
    }
  }

  async function handleDeleteReply(replyId) {
    setReplies(prev => prev.filter(r => r.id !== replyId));
    setComment(prev => ({ ...prev, replyCount: Math.max(0, (prev.replyCount || 1) - 1) }));
    try { await api.deleteComment(replyId); } catch {}
  }

  function confirmDelete() {
    setConfirmDel(true);
    setShowDots(false);
  }
  async function doDelete() {
    setConfirmDel(false);
    if (depth === 0) { onDeleteTop(comment.id); }
    else { onDeleteTop(comment.id); }
    try { await api.deleteComment(comment.id); } catch {}
  }

  function confirmAdminDelete() {
    setConfirmAdminDel(true);
    setShowDots(false);
  }
  async function doAdminDelete() {
    setConfirmAdminDel(false);
    onDeleteTop(comment.id);
    try { await adminApi.deleteComment(comment.id); } catch {}
  }

  const btnBase = {
    background: 'none', border: '1px solid var(--border-input)',
    borderRadius: 8, padding: '3px 8px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: 'var(--text-muted)', transition: 'all 0.12s',
  };

  return (
    <div style={{ marginLeft: depth > 0 ? 32 : 0 }}>
      {confirmDel && <DeleteConfirm onConfirm={doDelete} onCancel={() => setConfirmDel(false)} />}
      {confirmAdminDel && (
        <DeleteConfirm
          onConfirm={doAdminDelete}
          onCancel={() => setConfirmAdminDel(false)}
          title="Delete comment as admin?"
          subtitle="This bypasses ownership and can't be undone."
        />
      )}
      <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flexShrink: 0 }}>
          <UserAvatar src={comment.authorAvatar} name={name} userId={comment.authorId} size={depth > 0 ? 26 : 32} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtTime(comment.createdAt)}</span>
            {comment.edited && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>edited</span>}
          </div>

          {/* Content or edit box */}
          {editing ? (
            <div style={{ marginBottom: 7 }}>
              <textarea ref={editRef} value={editText} rows={2}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); } if (e.key === 'Escape') setEditing(false); }}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 10, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={submitEdit} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 7, whiteSpace: 'pre-wrap' }}>
              {/* @mention highlight */}
              {comment.content?.split(/(@\w+)/g).map((part, i) =>
                /^@\w+/.test(part)
                  ? <span key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>{part}</span>
                  : <span key={i}>{part}</span>
              )}
            </div>
          )}

          {/* Reaction badges */}
          {sortedReactions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
              {sortedReactions.map(([emoji, count]) => (
                <button key={emoji} onClick={() => react(emoji)}
                  style={{ ...btnBase, background: comment.userReactions?.includes(emoji) ? 'var(--accent-glow)' : 'var(--bg-hover)', border: `1px solid ${comment.userReactions?.includes(emoji) ? 'var(--accent)' : 'var(--border-input)'}`, color: comment.userReactions?.includes(emoji) ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {emoji} <span style={{ fontSize: 11 }}>{count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => vote('LIKE')}
              style={{ ...btnBase, border: `1px solid ${comment.userVote === 'LIKE' ? 'var(--accent)' : 'var(--border-input)'}`, background: comment.userVote === 'LIKE' ? 'var(--accent-glow)' : 'none', color: comment.userVote === 'LIKE' ? 'var(--accent)' : 'var(--text-muted)' }}>
              <LikeIcon a={comment.userVote === 'LIKE'} />
              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
            </button>
            <button onClick={() => vote('DISLIKE')}
              style={{ ...btnBase, border: `1px solid ${comment.userVote === 'DISLIKE' ? '#e06060' : 'var(--border-input)'}`, background: comment.userVote === 'DISLIKE' ? 'rgba(224,96,96,0.08)' : 'none', color: comment.userVote === 'DISLIKE' ? '#e06060' : 'var(--text-muted)' }}>
              <DislikeIcon a={comment.userVote === 'DISLIKE'} />
              {comment.dislikeCount > 0 && <span>{comment.dislikeCount}</span>}
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={togglePicker}
                style={{ ...btnBase, border: `1px solid ${isPickerOpen ? 'var(--accent)' : 'var(--border-input)'}`, background: isPickerOpen ? 'var(--accent-glow)' : 'none', color: isPickerOpen ? 'var(--accent)' : 'var(--text-muted)' }}>
                <EmojiIcon />
              </button>
              {isPickerOpen && <EmojiPicker onPick={react} onClose={() => setOpenPickerId(null)} />}
            </div>
            {depth === 0 && viewerId && (
              <button onClick={toggleReplies}
                style={{ ...btnBase, border: `1px solid ${isReplyOpen ? 'var(--accent)' : 'var(--border-input)'}`, color: isReplyOpen ? 'var(--accent)' : 'var(--text-muted)', background: isReplyOpen ? 'var(--accent-glow)' : 'none' }}>
                <ReplyIcon />
                {comment.replyCount > 0
                  ? <span>{isReplyOpen ? 'Hide ' : ''}{comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}</span>
                  : <span>Reply</span>}
              </button>
            )}

            {/* 3-dot menu — bottom right of action bar */}
            {viewerId && (
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                <button onClick={e => { e.stopPropagation(); setShowDots(d => !d); }}
                  style={{ ...btnBase, border: `1px solid ${showDots ? 'var(--accent)' : 'var(--border-input)'}`, background: showDots ? 'var(--accent-glow)' : 'none', color: showDots ? 'var(--accent)' : 'var(--text-muted)', padding: '3px 7px' }}>
                  <DotsIcon />
                </button>
                {showDots && (
                  <DotsMenu
                    isOwn={isOwn}
                    isAdmin={isAdmin}
                    onEdit={() => { setEditing(true); setEditText(comment.content); }}
                    onReply={handleMenuReply}
                    onDelete={confirmDelete}
                    onAdminDelete={confirmAdminDelete}
                    onClose={() => setShowDots(false)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Replies */}
          {depth === 0 && isReplyOpen && (
            <div style={{ marginTop: 8 }}>
              {replies.map(r => (
                <CommentRow key={r.id} comment={r}
                  onDeleteTop={handleDeleteReply}
                  viewerId={viewerId} isAdmin={isAdmin} depth={1}
                  openPickerId={openPickerId} setOpenPickerId={setOpenPickerId}
                  openReplyId={openReplyId}  setOpenReplyId={setOpenReplyId}
                  onMentionReply={text => { setReplyText(text); setTimeout(() => replyRef.current?.focus(), 50); }}
                />
              ))}
              {viewerId && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingTop: 8, paddingLeft: 4 }}>
                  <textarea ref={replyRef} value={replyText} rows={1}
                    onChange={e => { setReplyText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                    placeholder="Write a reply… (Enter to send)"
                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 14, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
                  />
                  <button onClick={submitReply} disabled={!replyText.trim()}
                    style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: replyText.trim() ? 1 : 0.4 }}>
                    <SendIcon />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sort dropdown ── */
function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const options = [
    { value: 'newest',  label: 'Newest first' },
    { value: 'oldest',  label: 'Oldest first' },
    { value: 'liked',   label: 'Most liked'   },
  ];
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const current = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 8px', borderRadius: 8 }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Sort by: {current?.label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg-menu)', border: '1px solid var(--border-input)', borderRadius: 12, padding: 6, zIndex: 400, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: o.value === value ? 'var(--bg-hover)' : 'none', border: 'none', color: o.value === value ? 'var(--accent)' : 'var(--text-primary)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: o.value === value ? 600 : 400 }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'none'; }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Exported CommentsPanel ── */
export default function CommentsPanel({ type, targetId, onClose, inline = false, hideInput = false }) {
  const { user } = useAuth();
  const requireAccount = useRequireAccount();
  const [comments,     setComments]     = useState([]);
  const [text,         setText]         = useState('');
  const [loading,      setLoading]      = useState(true);
  const [sort,         setSort]         = useState('newest');
  const [openPickerId, setOpenPickerId] = useState(null);
  const [openReplyId,  setOpenReplyId]  = useState(null);
  const [focused,      setFocused]      = useState(false);
  const textRef = useRef();

  const fetchComments = useCallback(() => {
    setLoading(true);
    const fn = type === 'post' ? api.getPostComments : api.getMediaComments;
    fn(targetId, user?.id)
      .then(data => setComments((data || []).filter(c => !c.parentId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type, targetId, user?.id]);

  useEffect(() => {
    setOpenPickerId(null); setOpenReplyId(null);
    fetchComments();
  }, [fetchComments]);

  const sorted = [...comments].sort((a, b) => {
    if (sort === 'liked')  return (b.likeCount || 0) - (a.likeCount || 0);
    if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return new Date(b.createdAt) - new Date(a.createdAt); // newest
  });

  async function submit() {
    if (!text.trim()) return;
    if (!requireAccount('comment')) return;
    const fn = type === 'post' ? api.addPostComment : api.addMediaComment;
    try {
      const c = await fn(targetId, { authorId: user.id, content: text.trim() });
      setComments(prev => [c, ...prev]);
      setText('');
      if (textRef.current) textRef.current.style.height = 'auto';
      setFocused(false);
    } catch {}
  }

  async function handleDelete(id) {
    setComments(prev => prev.filter(c => c.id !== id));
    try { await api.deleteComment(id); } catch {}
  }

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      onClick={() => setOpenPickerId(null)}>

      {/* ── Header: count + sort ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {comments.length > 0 ? comments.length.toLocaleString() : ''} Comments
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SortDropdown value={sort} onChange={setSort} />
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* ── Input — pinned below header like YouTube ── */}
      {!hideInput && (
        <div style={{ padding: '4px 18px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <UserAvatar src={user?.profilePicture} name={user?.displayName || user?.username} size={32} />
            <div style={{ flex: 1 }}>
              <textarea ref={textRef} value={text}
                onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') { setFocused(false); setText(''); } }}
                onFocus={() => setFocused(true)}
                placeholder="Add a comment…"
                rows={1}
                style={{ width: '100%', background: 'none', border: 'none', borderBottom: `2px solid ${focused ? 'var(--accent)' : 'var(--border-input)'}`, borderRadius: 0, padding: '6px 0', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
              />
              {(focused || text.trim()) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setFocused(false); setText(''); if (textRef.current) textRef.current.style.height = 'auto'; }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={!text.trim()}
                    style={{ background: text.trim() ? 'var(--accent)' : 'var(--bg-hover)', border: 'none', color: text.trim() ? '#fff' : 'var(--text-muted)', padding: '6px 16px', borderRadius: 20, cursor: text.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, transition: 'all 0.15s' }}>
                    Comment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scrollable comment list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>
        {loading
          ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          : sorted.length === 0
          ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No comments yet. Be the first!</div>
          : sorted.map(c => (
              <CommentRow key={c.id} comment={c}
                onDeleteTop={handleDelete}
                viewerId={user?.id} isAdmin={!!user?.admin}
                openPickerId={openPickerId} setOpenPickerId={setOpenPickerId}
                openReplyId={openReplyId}  setOpenReplyId={setOpenReplyId}
              />
            ))
        }
      </div>
    </div>
  );

  if (inline) return inner;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 201, boxShadow: '-8px 0 32px rgba(0,0,0,0.3)' }}>
        {inner}
      </div>
    </>
  );
}
