import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../services/api';
import { followApi, friendApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

function bannerSrc(pic)  { if (!pic) return null; return pic.startsWith('http') ? pic : `${API_BASE}${pic}`; }
function fmtJoinDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }); }

export default function UserProfileModal({ userId, onClose }) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [profile,       setProfile]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [followData,    setFollowData]    = useState({ following: false, followerCount: 0, followingCount: 0 });
  const [relationship,  setRelationship]  = useState({ status: 'NONE' });
  const [actionLoading, setActionLoading] = useState(false);

  const isMe = me?.id === userId;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getUser(userId),
      me && !isMe ? followApi.status(userId, me.id) : Promise.resolve(null),
      me && !isMe ? friendApi.relationship(userId, me.id) : Promise.resolve(null),
    ]).then(([p, f, r]) => {
      setProfile(p);
      if (f) setFollowData(f);
      if (r) setRelationship(r);
    }).catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId, me?.id, isMe]);

  async function handleFollow() {
    if (!me || isMe) return;
    setActionLoading(true);
    try { const res = await followApi.toggle(userId); setFollowData(res); }
    catch {} finally { setActionLoading(false); }
  }

  async function handleFriend() {
    if (!me || isMe) return;
    setActionLoading(true);
    try {
      const { status } = relationship;
      if (status === 'NONE') {
        const res = await friendApi.sendRequest(userId);
        setRelationship({ status: res.status || 'REQUEST_SENT' });
      } else if (status === 'REQUEST_RECEIVED') {
        const res = await friendApi.respond(relationship.requestId, 'ACCEPT');
        setRelationship({ ...relationship, status: res.status });
      } else if (status === 'FRIENDS' || status === 'REQUEST_SENT') {
        await friendApi.unfriend(userId);
        setRelationship({ status: 'NONE' });
      }
    } catch {} finally { setActionLoading(false); }
  }

  function friendBtnLabel() {
    switch (relationship.status) {
      case 'FRIENDS':          return '✓ Friends';
      case 'REQUEST_SENT':     return '⏳ Pending';
      case 'REQUEST_RECEIVED': return '✅ Accept';
      default:                 return '+ Add Friend';
    }
  }

  function goToProfile() {
    onClose();
    navigate(`/profile/${profile?.username || userId}`);
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" style={{ maxWidth: 380, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Close */}
        <div style={{ position: 'absolute', top: 10, right: 14, zIndex: 10 }}>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : !profile ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>User not found</div>
        ) : (
          <>
            {/* Banner */}
            <div style={{ height: 90, background: bannerSrc(profile.bannerPicture) ? `url(${bannerSrc(profile.bannerPicture)}) center/cover` : 'linear-gradient(135deg,#1a3a5c,#0f2040)', position: 'relative' }} />

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Avatar */}
              <div style={{ zIndex: 1, marginTop: -44, marginBottom: 10, border: '4px solid var(--bg-card)', borderRadius: '50%', cursor: 'pointer' }} onClick={goToProfile}>
                <UserAvatar
                  src={profile.profilePicture}
                  name={profile.displayName || profile.username}
                  userId={profile.id}
                  isFriend={relationship.status === 'FRIENDS'}
                  size={80}
                />
              </div>

              {/* Name — clickable to profile */}
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, textAlign: 'center', cursor: 'pointer' }} onClick={goToProfile}>
                {profile.displayName || profile.username}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, cursor: 'pointer' }} onClick={goToProfile}>@{profile.username}</div>

              {profile.bio && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 14, maxWidth: 280 }}>{profile.bio}</div>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{followData.followerCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Followers</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{followData.followingCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Following</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{fmtJoinDate(profile.createdAt)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Joined</div>
                </div>
              </div>

              {/* View full profile */}
              <button onClick={goToProfile} style={{ marginBottom: 10, width: '100%', padding: '8px 0', borderRadius: 20, border: '1px solid var(--border-input)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                View Full Profile
              </button>

              {/* Action buttons */}
              {!isMe && (
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button onClick={handleFollow} disabled={actionLoading} style={{ flex: 1, padding: '9px 0', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: followData.following ? 'var(--bg-hover)' : 'var(--accent)', border: followData.following ? '1px solid var(--border-input)' : 'none', color: followData.following ? 'var(--text-secondary)' : '#fff' }}>
                    {followData.following ? '✓ Following' : '+ Follow'}
                  </button>
                  <button onClick={handleFriend} disabled={actionLoading} style={{ flex: 1, padding: '9px 0', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: relationship.status === 'REQUEST_RECEIVED' ? '#4caf50' : 'var(--bg-hover)', border: '1px solid var(--border-input)', color: relationship.status === 'REQUEST_RECEIVED' ? '#fff' : 'var(--text-primary)' }}>
                    {friendBtnLabel()}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
