import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWS } from '../../context/WebSocketContext';
import { friendApi, API_BASE } from '../../services/api';
import UserAvatar from '../UserAvatar';

function resolveMedia(pic) {
  if (!pic) return null;
  return pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
}

const FlipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M17 2.1l4 4-4 4" /><path d="M3 12.6v-2a4 4 0 0 1 4-4h14" />
    <path d="M7 21.9l-4-4 4-4" /><path d="M21 11.4v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const PinIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'var(--accent)' : 'none'} stroke={filled ? 'var(--accent)' : 'currentColor'} strokeWidth="2" width="13" height="13">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14l-1.5-5H6.5L5 17z" />
    <path d="M8 12V5h8v7" />
  </svg>
);

const PIN_KEY = 'omni_pinned_friends';

function loadPins() {
  try {
    const raw = JSON.parse(localStorage.getItem(PIN_KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

/**
 * RightSidebar — flippable card: front shows the viewer's own profile,
 * back shows their friend list (pinned first, then online, then the
 * rest — each group sorted alphabetically). Local-only pinning (no
 * backend), persisted in localStorage.
 */
export default function RightSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subscribe } = useWS();
  const [flipped, setFlipped] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineIds, setOnlineIds] = useState({});
  const [pins, setPins] = useState(loadPins);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    friendApi.list(user.id).then(setFriends).catch(() => {}).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!subscribe) return;
    return subscribe(msg => {
      const msgType = msg._type || msg.type;
      if (msgType === 'PRESENCE') {
        setOnlineIds(prev => ({ ...prev, [msg.userId]: !!msg.online }));
      }
    });
  }, [subscribe]);

  const togglePin = useCallback((friendId) => {
    setPins(prev => {
      const next = { ...prev };
      if (next[friendId]) delete next[friendId];
      else next[friendId] = Date.now();
      localStorage.setItem(PIN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const sortedFriends = useMemo(() => {
    const byName = (a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username);
    const pinned  = friends.filter(f => pins[f.userId]).sort((a, b) => pins[b.userId] - pins[a.userId]);
    const online  = friends.filter(f => !pins[f.userId] && onlineIds[f.userId]).sort(byName);
    const offline = friends.filter(f => !pins[f.userId] && !onlineIds[f.userId]).sort(byName);
    return [...pinned, ...online, ...offline];
  }, [friends, pins, onlineIds]);

  if (!user) return null;

  return (
    <aside className="right-sidebar">
      <div className={`flip-card${flipped ? ' is-flipped' : ''}`}>
        <div className="flip-card-inner">

          {/* ── FRONT: profile card ── */}
          <div className="flip-face flip-face-front">
            <div className="profile-card-banner" style={user.bannerPicture ? {
              backgroundImage: `url(${resolveMedia(user.bannerPicture)})`,
            } : undefined}>
              <button className="flip-arrow profile-card-flip-btn" onClick={() => setFlipped(true)} title="Show friends" aria-label="Show friends">
                <FlipIcon />
              </button>
            </div>
            <div className="profile-card-avatar-wrap">
              <UserAvatar src={user.profilePicture} name={user.displayName || user.username} size={80} />
            </div>
            <div className="profile-card-body">
              <div className="profile-card-name">{user.displayName || user.username}</div>
              <div className="profile-card-username">@{user.username}</div>
              <div className="profile-card-stats">
                <div><strong>{(user.followerCount ?? 0).toLocaleString()}</strong><span>Followers</span></div>
                <div><strong>{(user.followingCount ?? 0).toLocaleString()}</strong><span>Following</span></div>
              </div>
              {user.bio && <div className="profile-card-bio">{user.bio}</div>}
              <button className="profile-card-view-btn" onClick={() => navigate(`/profile/${user.username}`)}>
                View profile
              </button>
            </div>
          </div>

          {/* ── BACK: friend list ── */}
          <div className="flip-face flip-face-back">
            <button className="flip-arrow" onClick={() => setFlipped(false)} title="Show profile" aria-label="Show profile">
              <FlipIcon />
            </button>
            <div className="friend-list-header">Friends</div>
            <div className="friend-list-body">
              {loading ? (
                <div className="friend-list-empty">Loading…</div>
              ) : sortedFriends.length === 0 ? (
                <div className="friend-list-empty">No friends yet.</div>
              ) : (
                sortedFriends.map(f => (
                  <div key={f.userId} className="friend-row" onClick={() => navigate(`/profile/${f.username}`)}>
                    <div className="friend-row-avatar">
                      <UserAvatar src={f.avatar} name={f.displayName || f.username} size={34} />
                      {onlineIds[f.userId] && <span className="friend-online-dot" />}
                    </div>
                    <div className="friend-row-info">
                      <div className="friend-row-name">{f.displayName || f.username}</div>
                      <div className="friend-row-sub">{onlineIds[f.userId] ? 'Online' : `@${f.username}`}</div>
                    </div>
                    <button
                      className={`friend-pin-btn${pins[f.userId] ? ' is-pinned' : ''}`}
                      onClick={e => { e.stopPropagation(); togglePin(f.userId); }}
                      title={pins[f.userId] ? 'Unpin' : 'Pin'}
                    >
                      <PinIcon filled={!!pins[f.userId]} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </aside>
  );
}
