import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { api, networkApi } from '../../services/api';
import UserAvatar from '../UserAvatar';

// Same fixed-position-off-getBoundingClientRect trick used elsewhere in the
// networks components (ChannelSidebar's AnchoredMenu, NetworkSettingsModal's
// role kebabs) — lets this float above chat scroll containers without being
// clipped, anchored to whatever the caller clicked (avatar or name).
function AnchoredCard({ anchorRef, onClose, width = 300, children }) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
  }, [anchorRef]);

  if (!rect) return null;

  const margin = 12;
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const openUp = spaceBelow < 320 && spaceAbove > spaceBelow;
  const maxHeight = (openUp ? spaceAbove : spaceBelow) - 8;

  let left = rect.left;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
  if (left < margin) left = margin;

  const style = {
    position: 'fixed', zIndex: 700, width,
    maxHeight: Math.max(maxHeight, 200), overflowY: 'auto',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    left,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 699 }} />
      <div onClick={e => e.stopPropagation()} style={style}>
        {children}
      </div>
    </>
  );
}

// Mirrors ChannelService.topRoleColor on the backend: highest-position role
// that actually has a colour set wins, so a colourless role higher up
// doesn't mask a coloured one below it.
function topRoleColor(roles) {
  const colored = (roles || []).filter(r => r.color && r.color.trim());
  if (colored.length === 0) return null;
  return colored.reduce((top, r) => (r.position > top.position ? r : top)).color;
}

export default function NetworkUserPopover({ anchorRef, networkId, userId, roleColor, onClose }) {
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteExpanded, setInviteExpanded] = useState(false);
  const [myNetworks, setMyNetworks] = useState(null);
  const [toast, setToast] = useState('');
  const kebabRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getUser(userId),
      networkId ? networkApi.getMembers(networkId).catch(() => []) : Promise.resolve([]),
    ])
      .then(([p, members]) => {
        if (cancelled) return;
        setProfile(p);
        const member = members.find(m => m.userId === userId);
        setRoles(member ? (member.roles || []) : []);
      })
      .catch(() => { if (!cancelled) { setProfile(null); setRoles([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, networkId]);

  const effectiveColor = topRoleColor(roles) || roleColor;

  function openMenu() {
    setMenuOpen(true);
    if (myNetworks === null) {
      networkApi.mine().then(setMyNetworks).catch(() => setMyNetworks([]));
    }
  }

  function inviteVia(net) {
    const url = `${window.location.origin}/invite/${net.inviteCode}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setToast(`Invite link for ${net.name} copied`);
    setTimeout(() => setToast(''), 1600);
  }

  function copyUserId() {
    navigator.clipboard?.writeText(String(userId)).catch(() => {});
    setToast('User ID copied');
    setTimeout(() => setToast(''), 1600);
  }

  const menuItemStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left' };

  return (
    <AnchoredCard anchorRef={anchorRef} onClose={onClose} width={300}>
      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      ) : !profile ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>User not found.</div>
      ) : (
        <>
          <div style={{ height: 56, background: 'linear-gradient(135deg, var(--bg-input), var(--bg-hover))', position: 'relative' }} />
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -28, marginBottom: 8 }}>
              <div style={{ border: '4px solid var(--bg-elevated)', borderRadius: '50%', lineHeight: 0 }}>
                <UserAvatar src={profile.profilePicture} name={profile.displayName || profile.username} size={64} />
              </div>
              <button
                ref={kebabRef}
                onClick={openMenu}
                title="More"
                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
              </button>
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: effectiveColor || 'var(--text-primary)' }}>
              {profile.displayName || profile.username}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>@{profile.username}</div>

            {roles && roles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {roles.map(r => (
                  <span
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                      color: 'var(--text-secondary)', background: 'var(--bg-input)', borderRadius: 4, padding: '3px 8px',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color || 'var(--text-muted)', flexShrink: 0 }} />
                    {r.name}
                  </span>
                ))}
              </div>
            )}

            {profile.bio && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {profile.bio}
              </div>
            )}
          </div>
        </>
      )}

      {menuOpen && (
        <AnchoredCard anchorRef={kebabRef} onClose={() => { setMenuOpen(false); setInviteExpanded(false); }} width={220}>
          <div style={{ padding: 6 }}>
            <button style={menuItemStyle} onClick={() => setInviteExpanded(v => !v)}>
              Invite to Server
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" style={{ transform: inviteExpanded ? 'rotate(90deg)' : 'none' }}><polyline points="9 18 15 12 9 6" /></svg>
            </button>
            {inviteExpanded && (
              <div style={{ maxHeight: 180, overflowY: 'auto', margin: '2px 0 2px 8px', borderLeft: '1px solid var(--border)', paddingLeft: 6 }}>
                {myNetworks === null && <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>}
                {myNetworks && myNetworks.length === 0 && <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>You're not in any servers yet.</div>}
                {myNetworks && myNetworks.map(net => (
                  <button
                    key={net.id}
                    onClick={() => inviteVia(net)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <UserAvatar src={net.iconUrl} name={net.name} size={20} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{net.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
            <button style={menuItemStyle} onClick={copyUserId}>
              Copy User ID
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
        </AnchoredCard>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)', zIndex: 800 }}>
          {toast}
        </div>
      )}
    </AnchoredCard>
  );
}
