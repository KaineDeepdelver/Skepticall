import React, { useEffect, useState } from 'react';
import { friendApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../UserAvatar';

/**
 * Discord-style "Invite friends" modal. Two ways in: pick a friend from the
 * list (real friends, via friendApi.list), or copy the network's invite
 * link. There's no per-friend invite-delivery backend (no DM-send REST
 * endpoint to piggyback on — messaging here is WebSocket-only), so the
 * per-row "Invite" button copies the link to that friend rather than
 * pretending to send something. Backdrop is a solid, mostly-opaque overlay
 * rather than the app's usual translucent dialog backdrop, matching the
 * reference screenshots.
 */
export default function InviteFriendsModal({ network, channel, onClose }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState('');

  const inviteUrl = `https://linkisleapp.com/invite/${network.inviteCode}`;

  useEffect(() => {
    if (!user?.id) return;
    friendApi.list(user.id)
      .then(setFriends)
      .catch(e => setError(e.message || 'Failed to load friends.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filtered = friends.filter(f => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (f.username || '').toLowerCase().includes(q) || (f.displayName || '').toLowerCase().includes(q);
  });

  function copyInviteFor(friendId) {
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopiedId(friendId);
    setTimeout(() => setCopiedId(id => (id === friendId ? null : id)), 2000);
  }

  function copyLink() {
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 440, maxHeight: '80vh', background: 'var(--bg-elevated)',
          borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ padding: '20px 24px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                Invite friends to {network.name}
              </div>
              {channel && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Recipients will land in #{channel.name}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div style={{ position: 'relative', marginTop: 14 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              className="auth-input" style={{ paddingLeft: 36 }}
              placeholder="Search for friends"
              value={query} onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading && <div style={{ padding: '24px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Loading friends…</div>}
          {error && <div style={{ padding: '12px 8px', fontSize: 13, color: '#e06060' }}>{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ padding: '24px 8px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              {friends.length === 0 ? "You don't have any friends yet." : 'No matches.'}
            </div>
          )}

          {filtered.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 6, transition: 'background-color 0.15s ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <UserAvatar src={f.profilePicture || f.avatar} name={f.displayName || f.username} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.displayName || f.username}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>@{f.username}</div>
              </div>
              <button
                onClick={() => copyInviteFor(f.id)}
                style={{
                  padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: copiedId === f.id ? 'var(--bg-input)' : 'var(--accent)',
                  color: copiedId === f.id ? 'var(--text-secondary)' : 'var(--accent-text)',
                  transition: 'background-color 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {copiedId === f.id ? 'Link copied' : 'Invite'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Or, send a server invite link to a friend
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="auth-input" readOnly value={inviteUrl} style={{ flex: 1 }} />
            <button
              onClick={copyLink}
              style={{
                padding: '8px 20px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: linkCopied ? 'var(--bg-input)' : 'var(--accent)',
                color: linkCopied ? 'var(--text-secondary)' : 'var(--accent-text)',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s ease',
              }}
            >
              {linkCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Your invite link expires in 7 days. <button onClick={() => {}} style={{ border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 12 }}>Edit invite link.</button>
          </div>
        </div>
      </div>
    </div>
  );
}
