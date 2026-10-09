import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE, friendApi } from '../services/api';

function fmtJoin(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}
function avatarSrc(pic) {
  if (!pic) return null;
  return resolveUrl(pic.startsWith('http') ? pic : `${API_BASE}${pic}`);
}
function bannerSrc(pic) {
  if (!pic) return null;
  return resolveUrl(pic.startsWith('http') ? pic : `${API_BASE}${pic}`);
}

// When an item has no server-generated thumbnailUrl, grab a frame straight
// from the video itself (seek to a random point, draw it to a canvas) so the
// grid never falls back to a blank placeholder for videos that just happen
// to be missing a thumbnail.
export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();

  // uid is resolved after profile loads
  const [uid,          setUid]          = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [relationship, setRelationship] = useState({ status: 'NONE' });
  const [actionLoading, setActionLoading] = useState(false);
  const [showAbout,     setShowAbout]     = useState(false);
  const isMe = uid != null && me?.id === uid;
  const BIO_TRUNCATE_AT = 130;
  const bioIsLong  = !!(profile?.bio && profile.bio.length > BIO_TRUNCATE_AT);
  const bioPreview = bioIsLong ? profile.bio.slice(0, BIO_TRUNCATE_AT).trimEnd() : profile?.bio;

  // Load profile + social data by username
  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setUid(null);

    api.getUserByUsername(username)
      .then(async (p) => {
        setProfile(p);
        setUid(p.id);
        const resolvedIsMe = me?.id === p.id;
        if (me && !resolvedIsMe) {
          const r = await friendApi.relationship(p.id, me.id);
          if (r) setRelationship(r);
        }
      })
      .catch(() => setProfile(undefined))
      .finally(() => setLoading(false));
  }, [username, me?.id]);

  async function handleFriend() {
    if (!me || isMe) return;
    setActionLoading(true);
    try {
      const { status } = relationship;
      if (status === 'NONE') {
        const res = await friendApi.sendRequest(uid);
        setRelationship({ status: res.status || 'REQUEST_SENT' });
      } else if (status === 'REQUEST_RECEIVED') {
        const res = await friendApi.respond(relationship.requestId, 'ACCEPT');
        setRelationship({ ...relationship, status: res.status });
      } else if (status === 'FRIENDS' || status === 'REQUEST_SENT') {
        await friendApi.unfriend(uid);
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

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  if (!profile) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>User not found</div>;

  const banner = bannerSrc(profile.bannerPicture);
  const avatar = avatarSrc(profile.profilePicture);

  return (
    <div className="main-content" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>

        {/* Back */}
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 0 4px', padding: '6px 0' }}>
          ← Back
        </button>

        {/* Banner — full width, YouTube-style */}
        <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginTop: 8, background: banner ? undefined : 'linear-gradient(135deg,#1a3a5c,#0f2040)' }}>
          {banner && <img src={banner} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </div>

        {/* Header row: avatar overlapping banner, info, action buttons — like a channel header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, marginTop: -48 }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0, border: '4px solid var(--bg-body)', borderRadius: '50%', background: 'var(--bg-body)', zIndex: 2 }}>
            {avatar
              ? <img src={avatar} alt={profile.username} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 700, color: '#fff' }}>{(profile.displayName || profile.username || '?').slice(0, 2).toUpperCase()}</div>
            }
          </div>

          {/* Info column */}
          <div style={{ flex: 1, minWidth: 240, paddingTop: 56 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{profile.displayName || profile.username}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>@{profile.username}</span>
              <span>·</span>
              <span>Joined {fmtJoin(profile.createdAt)}</span>
            </div>
            {profile.bio && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 8, marginBottom: 0, maxWidth: 640, whiteSpace: 'pre-wrap' }}>
                {bioIsLong ? bioPreview : profile.bio}
                {bioIsLong && (
                  <>
                    …{' '}
                    <span onClick={() => setShowAbout(true)}
                      style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
                      more
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Action buttons — Subscribe/Join-style pills */}
          {!isMe && (
            <div style={{ display: 'flex', gap: 10, paddingTop: 56, flexShrink: 0 }}>
              <button onClick={handleFriend} disabled={actionLoading}
                style={{ padding: '10px 24px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: relationship.status === 'FRIENDS' ? 'var(--bg-hover)' : relationship.status === 'REQUEST_RECEIVED' ? '#4caf50' : 'var(--bg-hover)',
                  border: '1px solid var(--border-input)',
                  color: relationship.status === 'REQUEST_RECEIVED' ? '#fff' : 'var(--text-primary)' }}>
                {friendBtnLabel()}
              </button>
            </div>
          )}
        </div>

      </div>
      {showAbout && (
        <div onClick={() => setShowAbout(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{profile.displayName || profile.username}</div>
              <button onClick={() => setShowAbout(false)}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {profile.bio && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Description</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 0, marginBottom: 24 }}>{profile.bio}</p>
              </>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>More info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ flexShrink: 0, color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Joined {fmtJoin(profile.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
