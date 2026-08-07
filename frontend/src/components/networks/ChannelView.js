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

export default function ChannelView({ networkId, channel, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [hasMore, setHasMore]   = useState(false);
  const [page, setPage]         = useState(0);
  const [draft, setDraft]       = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [popover, setPopover]   = useState(null); // { userId, anchor, roleColor }
  const listRef = useRef(null);

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
    setMessages([]); setLoading(true); setError('');
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
    setMessages(prev => [...prev, { id: tmpId, content, authorId: currentUserId, createdAt: new Date().toISOString(), _optimistic: true }]);
    setDraft('');
    try {
      const saved = await networkApi.postChannelMessage(networkId, channel.id, content);
      setMessages(prev => prev.map(m => m.id === tmpId ? saved : m));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      setError(e.message || 'Failed to send — permission denied, or announcement channels need POST_IN_ANNOUNCEMENTS.');
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-primary)' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-primary)',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>#</span>
        {channel.name}
        {TYPE_LABEL[channel.type] && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{TYPE_LABEL[channel.type]}</span>}
      </div>

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

        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 10, opacity: m._optimistic ? 0.6 : 1 }}>
            <UserAvatar
              src={m.authorAvatar}
              name={m.authorDisplayName || m.authorUsername}
              size={32}
              onClick={m.authorId ? (e => setPopover({ userId: m.authorId, anchor: e.currentTarget, roleColor: m.authorRoleColor })) : undefined}
            />
            <div style={{ minWidth: 0 }}>
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
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
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

      {error && (
        <div style={{ margin: '0 14px 8px', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>
          {error}
        </div>
      )}

      <div style={{ padding: 10, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
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
