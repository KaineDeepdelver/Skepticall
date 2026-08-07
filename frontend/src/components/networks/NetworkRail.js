import React, { useState } from 'react';
import { API_BASE, resolveUrl } from '../../services/api';

function NetworkIcon({ network, active, onClick }) {
  const initials = network.name
    .split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // network.iconUrl comes back from the backend as a relative path like
  // "/uploads/network_icon_xxx.png" — resolveUrl only rewrites *absolute*
  // localhost URLs to the current API_BASE (e.g. for tunnels), it doesn't
  // turn relative paths into absolute ones. Without this prefix the browser
  // resolves it against the frontend's own origin instead of the backend,
  // which 404s silently as a background-image.
  const rawIconUrl = network.iconUrl
    ? (network.iconUrl.startsWith('http') ? network.iconUrl : `${API_BASE}${network.iconUrl}`)
    : null;
  const iconUrl = resolveUrl(rawIconUrl);

  return (
    <button
      onClick={onClick}
      title={network.name}
      style={{
        width: 40, height: 40, borderRadius: active ? 12 : 20, flexShrink: 0,
        border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 600, overflow: 'hidden',
        background: iconUrl ? `center/cover no-repeat url(${iconUrl})` : 'var(--bg-elevated)',
        transition: 'border-radius 0.15s ease',
      }}
    >
      {!iconUrl && initials}
    </button>
  );
}

// Left-most rail: one icon per joined network, plus a "+" that opens the
// create/join panel. Mirrors Discord's server rail — this is the entry
// point into the whole Networks section.
export default function NetworkRail({ networks, activeNetworkId, onSelect, onAddClick }) {
  return (
    <div style={{
      width: 64, flexShrink: 0, background: 'var(--bg-sidebar)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: 10, borderRight: '1px solid var(--border)',
      overflowY: 'auto',
    }}>
      {networks.map(n => (
        <NetworkIcon
          key={n.id}
          network={n}
          active={String(n.id) === String(activeNetworkId)}
          onClick={() => onSelect(n)}
        />
      ))}

      {networks.length > 0 && <div style={{ width: 28, height: 1, background: 'var(--border)' }} />}

      <button
        onClick={onAddClick}
        title="Add a network"
        style={{
          width: 40, height: 40, borderRadius: 20, border: 'none', cursor: 'pointer',
          background: 'var(--bg-elevated)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
