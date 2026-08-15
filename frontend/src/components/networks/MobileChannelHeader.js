import React, { useEffect, useState } from 'react';
import { notifApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TYPE_LABEL = { TEXT: '', VOICE: '(voice)', ANNOUNCEMENT: '(announcements)' };

/**
 * Mobile-only top bar for the chat screen: back button (swiping right or
 * tapping it returns to the channel list, without clearing which channel
 * was active — same channel stays highlighted when you come back),
 * channel name, and member count.
 *
 * The back button carries the same global unread-notifications badge used
 * elsewhere in the app (bell icon in TopBar), not a fabricated per-channel
 * count — it's a real signal that something elsewhere needs attention.
 */
export default function MobileChannelHeader({ channel, network, onBack, onOpenSettings }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const fetch = () => notifApi.unreadCount(user.id).then(r => setUnread(r.count)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [user?.id]);

  if (!channel) return null;

  return (
    <div className="mobile-channel-header">
      <button className="mobile-channel-back" onClick={onBack} aria-label="Back to channel list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="22" height="22">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {unread > 0 && <span className="mobile-channel-back-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      <button
        className="mobile-channel-title"
        onClick={onOpenSettings ? () => onOpenSettings(channel, 'overview') : undefined}
      >
        <span className="mobile-channel-title-row">
          <span className="mobile-channel-hash">#</span>
          <span className="mobile-channel-name">{channel.name}</span>
          {onOpenSettings && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" className="mobile-channel-chevron">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          )}
        </span>
        <span className="mobile-channel-subtitle">
          {TYPE_LABEL[channel.type] ? `${TYPE_LABEL[channel.type]} · ` : ''}
          {network?.memberCount != null
            ? `${network.memberCount} member${network.memberCount === 1 ? '' : 's'}`
            : ''}
        </span>
      </button>
    </div>
  );
}
