import React, { useState } from 'react';
import { networkApi } from '../../services/api';

// Two tabs in one modal: create a brand new network, or join one via invite
// code. Styled with the same .dialog-* classes as ConfirmModal so it looks
// native to the app rather than a one-off.
export function CreateOrJoinNetworkModal({ onClose, onCreated, onJoined }) {
  const [tab, setTab]         = useState('create'); // 'create' | 'join'
  const [name, setName]       = useState('');
  const [inviteCode, setCode] = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');

  async function submit() {
    setBusy(true); setError('');
    try {
      if (tab === 'create') {
        if (!name.trim()) { setError('Give it a name first.'); setBusy(false); return; }
        const network = await networkApi.create(name.trim());
        onCreated(network);
      } else {
        if (!inviteCode.trim()) { setError('Paste an invite code first.'); setBusy(false); return; }
        const network = await networkApi.join(inviteCode.trim());
        onJoined(network);
      }
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="dialog-header">
          <span className="dialog-title">{tab === 'create' ? 'Create a network' : 'Join a network'}</span>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setTab('create')}
              style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: tab === 'create' ? 'var(--accent)' : 'var(--bg-input)', color: tab === 'create' ? 'var(--accent-text)' : 'var(--text-secondary)' }}
            >Create</button>
            <button
              onClick={() => setTab('join')}
              style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: tab === 'join' ? 'var(--accent)' : 'var(--bg-input)', color: tab === 'join' ? 'var(--accent-text)' : 'var(--text-secondary)' }}
            >Join with a code</button>
          </div>

          {tab === 'create' ? (
            <input className="auth-input" placeholder="Network name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          ) : (
            <input className="auth-input" placeholder="Invite code" value={inviteCode} onChange={e => setCode(e.target.value)} autoFocus />
          )}

          {error && (
            <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>{error}</div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="dialog-btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Working…' : tab === 'create' ? 'Create' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Matches the Discord reference: radio-style channel-type cards, a
// #-prefixed name field, and a "Private Channel" toggle. Type cards and the
// name field are fully wired; the Private Channel toggle is visual-only for
// now (same reason as the Permissions tab — no channel-level view gating
// exists on the backend yet), and Forum is shown but disabled since we
// don't have that concept at all.
export function CreateChannelModal({ presetType, categoryName, onClose, onCreated, onCreate }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(presetType || 'TEXT');
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) { setError('Give it a name first.'); return; }
    setBusy(true); setError('');
    try {
      const channel = await onCreate(name.trim(), type);
      onCreated(channel);
    } catch (e) {
      setError(e.message || 'Failed to create channel — you may not have MANAGE_CHANNELS permission.');
    } finally {
      setBusy(false);
    }
  }

  const TYPES = [
    {
      key: 'TEXT', label: 'Text', desc: 'Send messages, images, GIFs, emoji, opinions, and puns', disabled: false,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>,
    },
    {
      key: 'VOICE', label: 'Voice', desc: 'Hang out together with voice, video, and screen share', disabled: false,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>,
    },
    {
      key: 'FORUM', label: 'Forum', desc: 'Create a space for organized discussions', disabled: true,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    },
  ];

  return (
    <div className="dialog-overlay" style={{ background: 'rgba(0,0,0,0.88)' }} onClick={onClose}>
      <div className="dialog-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, background: 'var(--bg-elevated)' }}>
        <div className="dialog-header">
          <div>
            <div className="dialog-title" style={{ fontSize: 18, fontWeight: 700 }}>Create Channel</div>
            {categoryName && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>in {categoryName}</div>}
          </div>
          <button className="dialog-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '16px 20px' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Channel Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TYPES.map(t => (
                <label
                  key={t.key}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', borderRadius: 8,
                    background: 'var(--bg-input)', cursor: t.disabled ? 'not-allowed' : 'pointer',
                    opacity: t.disabled ? 0.5 : 1,
                    border: type === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                  onMouseEnter={!t.disabled ? (e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; } : undefined}
                  onMouseLeave={!t.disabled ? (e) => { e.currentTarget.style.backgroundColor = 'var(--bg-input)'; } : undefined}
                >
                  <input
                    type="radio" name="channel-type" checked={type === t.key} disabled={t.disabled}
                    onChange={() => !t.disabled && setType(t.key)} style={{ marginTop: 4, cursor: t.disabled ? 'not-allowed' : 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <div style={{ color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.key === 'TEXT' && <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>#</span>}
                      {t.label}
                      {t.disabled && <span style={{ fontSize: 10, fontWeight: 700, color: '#999', background: '#333', borderRadius: 3, padding: '2px 6px' }}>NOT AVAILABLE</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Channel Name</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600 }}>
                {type === 'VOICE' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 5 6 9H2v6h4l5 4V5z" /></svg>
                ) : '#'}
              </span>
              <input
                className="auth-input" style={{ paddingLeft: 32 }}
                placeholder="new-channel" value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                autoFocus
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, cursor: 'pointer', padding: '12px 0', borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ color: 'var(--text-secondary)', marginTop: 2, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Private Channel</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>Only selected members and roles will be able to view this channel.</div>
              </div>
            </div>
            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} style={{ flexShrink: 0, marginTop: 4, cursor: 'pointer', accentColor: 'var(--accent)', width: 18, height: 18 }} />
          </label>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>{error}</div>
          )}
        </div>

        <div className="dialog-footer" style={{ padding: '16px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
          <button className="dialog-btn secondary" onClick={onClose} disabled={busy} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button className="dialog-btn primary" onClick={submit} disabled={busy} style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{busy ? 'Creating…' : 'Create Channel'}</button>
        </div>
      </div>
    </div>
  );
}

// Lightweight name-only modal for creating a category.
export function CreateCategoryModal({ onClose, onCreated, onCreate }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) { setError('Give it a name first.'); return; }
    setBusy(true); setError('');
    try {
      const category = await onCreate(name.trim());
      onCreated(category);
    } catch (e) {
      setError(e.message || 'Failed to create category — you may not have MANAGE_CHANNELS permission.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" style={{ background: 'rgba(0,0,0,0.88)' }} onClick={onClose}>
      <div className="dialog-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, background: 'var(--bg-elevated)' }}>
        <div className="dialog-header">
          <span className="dialog-title">Create Category</span>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Category Name</label>
          <input className="auth-input" placeholder="new category" value={name} onChange={e => setName(e.target.value.toUpperCase())} autoFocus />
          {error && (
            <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>{error}</div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="dialog-btn primary" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Category'}</button>
        </div>
      </div>
    </div>
  );
}
