import React from 'react';
import { API_BASE, resolveUrl } from '../services/api';

/**
 * UserAvatar — shared avatar component.
 *
 * Props:
 *   src     — profile picture URL (relative or absolute)
 *   name    — display name (for initials fallback)
 *   size    — diameter in px (default 36)
 *   onClick — optional click handler
 *   style   — extra styles on the wrapper
 */
export default function UserAvatar({ src, name, size = 36, userId, onClick, style }) {
  const raw = src ? (src.startsWith('http') ? src : `${API_BASE}${src}`) : null;
  const url = resolveUrl(raw);

  const initials = (name || '?').slice(0, 2).toUpperCase();

  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    cursor: onClick ? 'pointer' : undefined,
    display: 'block',
    ...style,
  };

  if (url) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, isolation: 'isolate', mixBlendMode: 'normal', display: 'block', ...style }}>
        <img
          src={url}
          alt={name}
          onClick={onClick}
          style={{ ...base, objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        ...base,
        background: 'var(--gradient)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
        color: 'var(--accent-text)',
      }}
    >
      {initials}
    </div>
  );
}
