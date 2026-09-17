import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifApi, API_BASE } from '../services/api';

const MAX_NOTIFS = 10;

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ src, name, size = 36 }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  if (src) {
    const full = src.startsWith('http') ? src : `${API_BASE}${src}`;
    return (
      <img
        src={full}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg,#4facfe,#00c6ff)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function AvatarStack({ notifications, size = 32 }) {
  const shown = notifications.slice(0, 3);
  const extra = notifications.length - shown.length;
  return (
    <div style={{
      position: 'relative',
      width: size + (shown.length - 1) * (size * 0.55) + (extra > 0 ? size * 0.55 : 0),
      height: size, flexShrink: 0,
    }}>
      {shown.map((n, i) => (
        <div key={n.id} style={{
          position: 'absolute', left: i * (size * 0.55), top: 0,
          zIndex: shown.length - i,
          border: '2px solid var(--bg-sidebar)', borderRadius: '50%',
        }}>
          <Avatar src={n.actorAvatar} name={n.actorDisplayName || n.actorUsername} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          position: 'absolute', left: shown.length * (size * 0.55), top: 0,
          width: size, height: size, borderRadius: '50%',
          background: 'var(--bg-hover)',
          border: '2px solid var(--bg-sidebar)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.3, fontWeight: 700, color: 'var(--text-secondary)',
          zIndex: 0,
        }}>+{extra}</div>
      )}
    </div>
  );
}

/**
 * Group notifications:
 * - MESSAGE type: grouped by actorId (same sender stacks as "x10")
 * - FOLLOW: grouped by actorId
 * - POST/MEDIA/COMMENT: grouped by type+refId (multiple actors on same content)
 *
 * Result is limited to MAX_NOTIFS groups.
 */
function groupNotifications(notifs) {
  const groups = [];
  const seen   = new Map();

  for (const n of notifs) {
    let key;
    if (n.type === 'MESSAGE' || n.type === 'FOLLOW') {
      key = `${n.type}_${n.actorId}`;
    } else {
      key = `${n.type}_${n.refId ?? 'null'}`;
    }

    if (seen.has(key)) {
      groups[seen.get(key)].items.push(n);
    } else {
      seen.set(key, groups.length);
      groups.push({ key, type: n.type, refId: n.refId, items: [n] });
    }
  }

  return groups.slice(0, MAX_NOTIFS);
}

function groupText(group) {
  const { type, items } = group;
  const count     = items.length;
  const first     = items[0];
  const firstName = first.actorDisplayName || first.actorUsername || 'Someone';

  // Stacked same-actor (MESSAGE / FOLLOW) → show count suffix
  if (type === 'MESSAGE') {
    if (count === 1) return `${firstName} sent you a message`;
    return `${firstName} sent you ${count} messages`;
  }

  if (count === 1) {
    return first.text || `${firstName} sent you a notification`;
  }

  const others = count - 1;
  const suffix = others === 1 ? '1 other' : `${others} others`;

  switch (type) {
    case 'POST':    return `${firstName} and ${suffix} liked your post`;
    case 'MEDIA':   return `${firstName} and ${suffix} liked your media`;
    case 'COMMENT': return `${firstName} and ${suffix} commented`;
    case 'FOLLOW':  return `${firstName} and ${suffix} followed you`;
    default:        return `${firstName} and ${others} others sent notifications`;
  }
}

function notifTarget(group) {
  const n = group.items[0];
  switch (n.type) {
    case 'POST':    return n.refSlug ? `/post/${n.refSlug}` : (n.refId ? `/post/${n.refId}` : '/');
    case 'MEDIA':   return n.refId ? `/media?v=${n.refId}` : '/media';
    case 'MESSAGE': return '/messages';
    case 'FOLLOW':  return n.actorUsername ? `/profile/${n.actorUsername}` : (n.actorId ? `/profile/${n.actorId}` : '/');
    default:        return '/';
  }
}

function typeIcon(type) {
  const s = { width: 14, height: 14 };
  switch (type) {
    case 'POST':
    case 'MEDIA':
      return (
        <svg {...s} viewBox="0 0 24 24" fill="#f43f5e">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      );
    case 'FOLLOW':
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#4facfe" strokeWidth="2.5">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      );
    case 'COMMENT':
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      );
    case 'MESSAGE':
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      );
    default:
      return null;
  }
}

export default function NotificationPanel({ userId, onClose, onReadCountChange }) {
  const navigate = useNavigate();
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await notifApi.getAll(userId);
      setNotifs(data);
    } catch {} finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const groups      = groupNotifications(notifs);
  const unreadCount = notifs.filter(n => !n.read).length;

  // Mark all items in a group as read locally + via API
  async function markGroupRead(group) {
    // Optimistic update
    setNotifs(prev =>
      prev.map(n =>
        group.items.some(gi => gi.id === n.id) ? { ...n, read: true } : n
      )
    );
    // Call API for each notification in the group
    for (const item of group.items) {
      if (!item.read) {
        notifApi.markOneRead(item.id).catch(() => {});
      }
    }
    // Notify parent that unread count changed
    const nowUnread = notifs.filter(n => !n.read && !group.items.some(gi => gi.id === n.id)).length;
    if (onReadCountChange) onReadCountChange(nowUnread);
  }

  async function handleClick(group) {
    await markGroupRead(group);
    navigate(notifTarget(group));
    onClose();
  }

  async function handleMarkRead(e, group) {
    e.stopPropagation();
    await markGroupRead(group);
  }

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />

      {/* panel */}
      <div className="notif-panel" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 300,
        width: 380,
        background: 'rgba(13, 13, 13, 0.95)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          .notif-row:hover { background: var(--bg-hover) !important; }
          .notif-row:hover .notif-mark-read { opacity: 1 !important; }
        `}</style>

        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: 'var(--accent-text)',
                borderRadius: 99, fontSize: 11, fontWeight: 700,
                padding: '1px 7px', lineHeight: '18px',
              }}>{unreadCount}</span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Loading…
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div>
              No notifications yet
            </div>
          ) : groups.map(group => {
            const isUnread  = group.items.some(n => !n.read);
            const latest    = group.items[0];
            const isStacked = group.items.length > 1;
            const stackCount = group.items.length;

            return (
              <div
                key={group.key}
                className="notif-row"
                onClick={() => handleClick(group)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  padding: '0',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: 'transparent',
                  transition: 'background 0.12s',
                  position: 'relative',
                }}
              >
                {/* ── Unread indicator column (left) ── */}
                <div style={{
                  width: 28,
                  flexShrink: 0,
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isUnread && (
                    <div style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      boxShadow: '0 0 6px rgba(79,172,254,0.6)',
                      flexShrink: 0,
                    }} />
                  )}
                </div>

                {/* ── Main content area ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: 1,
                  minWidth: 0,
                  padding: '13px 14px 13px 0',
                }}>
                  {/* avatar(s) */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {isStacked
                      ? <AvatarStack notifications={group.items} size={36} />
                      : <Avatar src={latest.actorAvatar} name={latest.actorDisplayName || latest.actorUsername} size={38} />
                    }
                    {/* type icon badge */}
                    <div style={{
                      position: 'absolute',
                      bottom: -2,
                      right: isStacked
                        ? -2 + (Math.min(group.items.length, 3) - 1) * (36 * 0.55)
                        : -2,
                      background: 'var(--bg-sidebar)',
                      borderRadius: '50%',
                      width: 20, height: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid var(--border)',
                    }}>
                      {typeIcon(group.type)}
                    </div>
                  </div>

                  {/* text block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: isUnread ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: isUnread ? 600 : 400,
                    }}>
                      {groupText(group)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {fmtTime(latest.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* mark-as-read button (appears on hover if unread) */}
                  {isUnread && (
                    <button
                      className="notif-mark-read"
                      onClick={(e) => handleMarkRead(e, group)}
                      title="Mark as read"
                      style={{
                        opacity: 0,
                        transition: 'opacity 0.15s',
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '3px 6px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: 11,
                        fontWeight: 500,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.color = 'var(--accent)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      ✓ Read
                    </button>
                  )}
                </div>

                {/* right padding spacer */}
                <div style={{ width: 14, flexShrink: 0 }} />
              </div>
            );
          })}

          {/* Footer note when capped */}
          {groups.length === MAX_NOTIFS && (
            <div style={{
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border)',
            }}>
              Showing latest {MAX_NOTIFS} notifications
            </div>
          )}
        </div>
      </div>
    </>
  );
}
