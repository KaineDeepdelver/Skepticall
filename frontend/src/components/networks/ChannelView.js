import React, { useEffect, useRef, useState, useCallback } from 'react';
import { networkApi } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import UserAvatar from '../UserAvatar';
import NetworkUserPopover from './NetworkUserPopover';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

const TYPE_LABEL = { TEXT: '', VOICE: '(voice)', ANNOUNCEMENT: '(announcements)' };

export default function ChannelView({ networkId, channel, currentUserId, hideHeader = false }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [hasMore, setHasMore]   = useState(false);
  const [page, setPage]         = useState(0);
  const [draft, setDraft]       = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [popover, setPopover]   = useState(null); // { userId, anchor, roleColor }
  const [replyTarget, setReplyTarget] = useState(null); // the message object being replied to, or null
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteModalTarget, setDeleteModalTarget] = useState(null); // message pending delete confirmation
  const listRef = useRef(null);
  const messageRefs = useRef({}); // id -> DOM node, so clicking a quoted preview can scroll to the original

  function scrollToMessage(id) {
    const node = messageRefs.current[id];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.style.transition = 'background-color 0.2s';
    node.style.backgroundColor = 'var(--bg-hover, rgba(255,255,255,0.06))';
    setTimeout(() => { node.style.backgroundColor = ''; }, 900);
  }

  const load = useCallback(async (pageToLoad) => {
    if (!channel) return;
    try {
      const result = await networkApi.getChannelMessages(networkId, channel.id, pageToLoad, 50);
      const items = (result.content || []).slice().reverse(); // API returns newest-first; render oldest-first
      setMessages(prev => pageToLoad === 0 ? items : [...items, ...prev]);
      setHasMore(!result.last);
      setPage(pageToLoad);
    } catch (e) {
      setError(e.message || 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [networkId, channel]);

  useEffect(() => {
    setMessages([]); setLoading(true); setError(''); setReplyTarget(null);
    load(0);
  }, [channel?.id]);

  // Live updates — without this, messages from other members only ever
  // showed up on a full reload, since this view previously had zero
  // WebSocket subscription and relied entirely on the initial REST fetch.
  const handleWsMessage = useCallback((msg) => {
    if (!msg || msg.channelId == null || !channel || Number(msg.channelId) !== Number(channel.id)) return;
    setMessages(prev => {
      // Already-known message (or an edit to one) — update in place rather
      // than appending a duplicate. Edits reuse the same message id.
      const existingIdx = prev.findIndex(m => m.id === msg.id);
      if (existingIdx !== -1) {
        return prev.map((m, i) => i === existingIdx ? msg : m);
      }
      // This is our own message coming back over the socket — it may well
      // arrive before the REST response does, so replace the optimistic
      // placeholder instead of appending a second copy of it.
      if (msg.authorId === currentUserId) {
        const idx = prev.findIndex(m => m._optimistic && m.content === msg.content);
        if (idx !== -1) {
          return prev.map((m, i) => i === idx ? msg : m);
        }
      }
      return [...prev, msg];
    });
  }, [channel?.id, currentUserId]);

  const { subscribeToChannel } = useWebSocket(currentUserId, handleWsMessage);
  useEffect(() => {
    if (channel?.id) subscribeToChannel(channel.id);
  }, [channel?.id, subscribeToChannel]);

  useEffect(() => {
    if (page === 0 && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, page]);

  if (!channel) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Pick a channel to get started.
      </div>
    );
  }

  if (channel.type === 'VOICE') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="34" height="34"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        <div style={{ fontSize: 13 }}>Voice channels aren't wired up yet — coming in a later pass.</div>
      </div>
    );
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true); setError('');
    const tmpId = `tmp-${Date.now()}`;
    const replyingTo = replyTarget;
    setMessages(prev => [...prev, {
      id: tmpId, content, authorId: currentUserId, createdAt: new Date().toISOString(), _optimistic: true,
      replyToId: replyingTo?.id ?? null,
      replyToAuthorUsername: replyingTo?.authorUsername ?? null,
      replyToAuthorDisplayName: replyingTo?.authorDisplayName ?? null,
      replyToContent: replyingTo?.content ?? null,
    }]);
    setDraft('');
    setReplyTarget(null);
    try {
      const saved = await networkApi.postChannelMessage(networkId, channel.id, content, undefined, replyingTo?.id);
      setMessages(prev => prev.map(m => m.id === tmpId ? saved : m));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      setError(e.message || 'Failed to send — permission denied, or announcement channels need POST_IN_ANNOUNCEMENTS.');
      setDraft(content);
      setReplyTarget(replyingTo);
    } finally {
      setSending(false);
    }
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditDraft(m.content || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft('');
  }

  async function saveEdit(m) {
    const content = editDraft.trim();
    if (!content) return;
    if (content === m.content) { cancelEdit(); return; }
    try {
      const updated = await networkApi.editChannelMessage(networkId, channel.id, m.id, content);
      setMessages(prev => prev.map(x => x.id === m.id ? updated : x));
    } catch (e) {
      setError(e.message || 'Failed to edit message.');
    } finally {
      cancelEdit();
    }
  }

  async function performDelete(m) {
    // No WS broadcast on delete (see ChannelController), so this only
    // reflects for the deleter unless everyone happens to reload — fine
    // for now, matches the current backend contract.
    try {
      await networkApi.deleteChannelMessage(networkId, channel.id, m.id);
      setMessages(prev => prev.filter(x => x.id !== m.id));
    } catch (e) {
      setError(e.message || 'Failed to delete message.');
    }
  }

  function handleDeleteClick(m, e) {
    if (e?.shiftKey) {
      performDelete(m); // hold shift to skip the confirmation, same as Discord
    } else {
      setDeleteModalTarget(m);
    }
  }

  function copyText(m) {
    navigator.clipboard?.writeText(m.content || '');
  }

  const toolbarBtnStyle = {
    background: 'none', border: 'none', borderRadius: 5,
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--text-muted)',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-primary)' }}>
      <style>{`
        .channel-message-row:hover { background: var(--bg-hover, rgba(255,255,255,0.03)); }
        .channel-message-row:hover .channel-message-toolbar { opacity: 1 !important; }
        .channel-toolbar-btn:hover { background: var(--bg-hover, rgba(255,255,255,0.08)); color: var(--text-primary); }
        .channel-toolbar-btn-danger:hover { background: rgba(224,96,96,0.15); color: #e06060; }
      `}</style>
      {!hideHeader && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-primary)',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>#</span>
          {channel.name}
          {TYPE_LABEL[channel.type] && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{TYPE_LABEL[channel.type]}</span>}
        </div>
      )}

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Loading…</div>}

        {!loading && hasMore && (
          <button
            onClick={() => load(page + 1)}
            style={{ alignSelf: 'center', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            Load earlier messages
          </button>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
            No messages yet — say something.
          </div>
        )}

        {messages.map(m => {
          const pingsMe = currentUserId != null && (
            (m.replyToAuthorId != null && Number(m.replyToAuthorId) === Number(currentUserId)) ||
            (Array.isArray(m.mentionedUserIds) && m.mentionedUserIds.map(Number).includes(Number(currentUserId)))
          );
          return (
          <div
            key={m.id}
            ref={el => { if (el) messageRefs.current[m.id] = el; else delete messageRefs.current[m.id]; }}
            className="channel-message-row"
            style={{
              opacity: m._optimistic ? 0.6 : 1, padding: '6px 10px 6px 8px', borderRadius: 6, position: 'relative',
              background: pingsMe ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
              borderLeft: pingsMe ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {m.replyToId != null && (
              <div
                onClick={m.replyToDeleted ? undefined : () => scrollToMessage(m.replyToId)}
                style={{
                  display: 'flex', alignItems: 'center', marginLeft: 16, marginBottom: 2,
                  fontSize: 12, color: 'var(--text-muted)', cursor: m.replyToDeleted ? 'default' : 'pointer', maxWidth: 460,
                }}
              >
                {/* Discord-style curved connector: drops from above, curves right into the quoted line */}
                <svg width="26" height="14" viewBox="0 0 26 14" style={{ flexShrink: 0, overflow: 'visible' }}>
                  <path d="M 6 0 V 6 C 6 10 9 10 13 10 H 22" fill="none" stroke={m.replyToDeleted ? 'var(--text-muted)' : 'var(--accent)'} strokeWidth="2" strokeLinecap="round" />
                </svg>
                {m.replyToDeleted ? (
                  <span style={{ fontStyle: 'italic', opacity: 0.75 }}>Original message was deleted</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <UserAvatar
                      src={m.replyToAuthorAvatar}
                      name={m.replyToAuthorDisplayName || m.replyToAuthorUsername}
                      size={16}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {m.replyToAuthorDisplayName || m.replyToAuthorUsername || 'someone'}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {m.replyToContent || ''}
                    </span>
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <UserAvatar
                src={m.authorAvatar}
                name={m.authorDisplayName || m.authorUsername}
                size={32}
                onClick={m.authorId ? (e => setPopover({ userId: m.authorId, anchor: e.currentTarget, roleColor: m.authorRoleColor })) : undefined}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  <span
                    onClick={m.authorId ? (e => setPopover({ userId: m.authorId, anchor: e.currentTarget, roleColor: m.authorRoleColor })) : undefined}
                    style={{ color: m.authorRoleColor || 'var(--text-primary)', cursor: m.authorId ? 'pointer' : 'default', fontWeight: 600 }}
                  >
                    {m.authorDisplayName || m.authorUsername || 'you'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{formatTime(m.createdAt)}</span>
                  {m.edited && <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>(edited)</span>}
                </div>
                {editingId === m.id ? (
                  <div style={{ marginTop: 3 }}>
                    <input
                      className="auth-input"
                      autoFocus
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(m); }
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      style={{ fontSize: 13.5, padding: '5px 8px' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      escape to <span onClick={cancelEdit} style={{ cursor: 'pointer', color: 'var(--accent)' }}>cancel</span> · enter to <span onClick={() => saveEdit(m)} style={{ cursor: 'pointer', color: 'var(--accent)' }}>save</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.content}
                  </div>
                )}
              </div>
            </div>

            {!m._optimistic && editingId !== m.id && (
              <div
                className="channel-message-toolbar"
                style={{
                  position: 'absolute', top: -6, right: 8, zIndex: 5,
                  display: 'flex', alignItems: 'center', gap: 1, opacity: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <button
                  onClick={() => setReplyTarget(m)}
                  title="Reply"
                  className="channel-toolbar-btn"
                  style={toolbarBtnStyle}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M9 17 4 12l5-5" /><path d="M4 12h11a4 4 0 0 0 4-4V7" />
                  </svg>
                </button>

                {m.authorId === currentUserId && (
                  <button onClick={() => startEdit(m)} title="Edit" className="channel-toolbar-btn" style={toolbarBtnStyle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                )}

                <button onClick={() => copyText(m)} title="Copy text" className="channel-toolbar-btn" style={toolbarBtnStyle}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>

                {m.authorId === currentUserId && (
                  <button
                    onClick={(e) => handleDeleteClick(m, e)}
                    title="Delete"
                    className="channel-toolbar-btn channel-toolbar-btn-danger"
                    style={toolbarBtnStyle}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {popover && (
        <NetworkUserPopover
          anchorRef={{ current: popover.anchor }}
          networkId={networkId}
          userId={popover.userId}
          roleColor={popover.roleColor}
          onClose={() => setPopover(null)}
        />
      )}

      {deleteModalTarget && (
        <div
          onClick={() => setDeleteModalTarget(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
              width: 440, maxWidth: '90vw', padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Delete Message</div>
              <button
                onClick={() => setDeleteModalTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Are you sure you want to delete this message?
            </div>

            <div style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 14 }}>
              <UserAvatar
                src={deleteModalTarget.authorAvatar}
                name={deleteModalTarget.authorDisplayName || deleteModalTarget.authorUsername}
                size={32}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  <span style={{ fontWeight: 600 }}>{deleteModalTarget.authorDisplayName || deleteModalTarget.authorUsername || 'you'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{formatTime(deleteModalTarget.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {deleteModalTarget.content}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>PROTIP: </span>
              You can hold down shift when clicking delete to bypass this confirmation entirely.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setDeleteModalTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13.5, padding: '8px 14px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { performDelete(deleteModalTarget); setDeleteModalTarget(null); }}
                style={{ background: '#e06060', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, borderRadius: 6, padding: '8px 16px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ margin: '0 14px 8px', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>
          {error}
        </div>
      )}

      {replyTarget && (
        <div style={{
          margin: '0 10px', padding: '6px 10px', borderRadius: '8px 8px 0 0',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderBottom: 'none',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" width="12" height="12" style={{ flexShrink: 0, transform: 'scaleX(-1)' }}>
            <path d="M9 17 4 12l5-5" /><path d="M4 12h11a4 4 0 0 0 4-4V7" />
          </svg>
          <span>
            Replying to <strong style={{ color: 'var(--accent)' }}>{replyTarget.authorDisplayName || replyTarget.authorUsername || 'someone'}</strong>
          </span>
          <button
            onClick={() => setReplyTarget(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      <div className="channel-input-bar" style={{ paddingTop: 10, paddingLeft: 10, paddingRight: 10, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          className="auth-input"
          placeholder={channel.type === 'ANNOUNCEMENT' ? `Announce in #${channel.name}` : `Message #${channel.name}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={sending}
        />
      </div>
    </div>
  );
}
