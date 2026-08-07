import React from 'react';
import { useNavigate } from 'react-router-dom';
import OmniLogo from '../OmniLogo';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../services/api';

function DefaultAvatar({ size = 32, name = '' }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff' }}>
      {initials}
    </div>
  );
}

/**
 * Dedicated topbar for the standalone /media/watch/:id page.
 * Deliberately separate from the global TopBar so it can be transparent
 * during ambient/reactive mode without needing any cross-component context
 * wiring — `reactive` is just a prop, owned by the parent Watch page.
 */
export default function WatchTopBar({ reactive, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const picSrc = user?.profilePicture
    ? (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE}${user.profilePicture}`)
    : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 200,
      height: 58,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      background: 'transparent', // fully transparent — this page owns its own background/ambient glow
      boxSizing: 'border-box',
      gap: 8,
      pointerEvents: 'none', // let clicks pass through empty space; buttons re-enable below
    }}>
      {/* Left: back + logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto' }}>
        <button
          onClick={onBack || (() => navigate(-1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 4, fontSize: 14 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <OmniLogo size={20} onClick={() => navigate('/')} />
      </div>

      {/* Right: profile only — keep this page's chrome minimal */}
      <button
        onClick={() => navigate('/')}
        style={{
          pointerEvents: 'auto',
          background: 'none', border: '1px solid var(--border-input)',
          borderRadius: 4, padding: 0, cursor: 'pointer',
          width: 34, height: 34, overflow: 'hidden',
        }}
      >
        {picSrc
          ? <img src={picSrc} alt="me" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <DefaultAvatar size={30} name={user?.displayName || user?.username} />
        }
      </button>
    </div>
  );
}
