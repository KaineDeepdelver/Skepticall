import React from 'react';

// Lightweight "are you sure?" modal — themed to match the app instead of the
// native browser confirm(). Used for deleting posts, comments, and media.
export default function ConfirmModal({ title = 'Delete this?', message, confirmLabel = 'Delete', onClose, onConfirm, confirming, error, danger = true }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="dialog-header">
          <span className="dialog-title">{title}</span>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="dialog-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{message}</p>
          {error && (
            <div style={{
              marginTop: 4, padding: '9px 14px', borderRadius: 8, fontSize: 13,
              background: 'rgba(224,96,96,0.12)', color: '#e06060',
              border: '1px solid rgba(224,96,96,0.3)',
            }}>{error}</div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={onClose} disabled={confirming}>Cancel</button>
          <button className={`dialog-btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
