import React, { useState, useRef, useEffect } from 'react';
import OmniLogo from '../components/OmniLogo';
import UserAvatar from '../components/UserAvatar';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, adminApi, resolveUrl } from '../services/api';

// == Icons ==
const IcAccount    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcProfile    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M8 8h8M8 16h5"/></svg>;
const IcAppearance = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>;
const IcPrivacy    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcPresence   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>;
const IcNotif      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcSecurity   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcSignOut    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcTrash      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
const IcChevron    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>;
const IcChevronLeft= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>;
const IcCamera     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IcCheck      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>;
const IcEye        = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcEyeOff     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcShield     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;
const IcAlertTriangle = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcSearch     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcClock      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

// == Helpers ==
function maskedEmail(email) {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

// == Sub-components ==
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <label className="toggle-switch" style={disabled ? { opacity: 0.45, pointerEvents: 'none' } : {}}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
      <span className="toggle-slider" />
    </label>
  );
}

function SettingRow({ label, desc, children, noBorder }) {
  return (
    <div className="omni-page-enter setting-row" style={noBorder ? { borderBottom: 'none' } : {}}>
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        {desc && <span className="setting-desc">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children, mt }) {
  return <div className="settings-section-title" style={mt ? { marginTop: mt } : {}}>{children}</div>;
}

function AccRow({ label, value, onClick, danger }) {
  return (
    <div className="acc-row" onClick={onClick} style={danger ? { color: '#e06060' } : {}}>
      <span className="acc-row-label" style={danger ? { color: '#e06060' } : {}}>{label}</span>
      <span className="acc-row-value" style={danger ? { color: '#e06060' } : {}}>
        {value && <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>}
        <IcChevron />
      </span>
    </div>
  );
}

// Inline status message
function StatusMsg({ text, type }) {
  if (!text) return null;
  return (
    <div style={{
      marginTop: 10, padding: '9px 14px', borderRadius: 8, fontSize: 13,
      background: type === 'ok' ? 'rgba(76,175,80,0.12)' : 'rgba(224,96,96,0.12)',
      color: type === 'ok' ? '#4caf50' : '#e06060',
      border: `1px solid ${type === 'ok' ? 'rgba(76,175,80,0.3)' : 'rgba(224,96,96,0.3)'}`,
    }}>{text}</div>
  );
}

// Password input with show/hide
function PwInput({ value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input className="dialog-input" type={show ? 'text' : 'password'}
        value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus}
        style={{ paddingRight: 40 }} />
      <button onClick={() => setShow(s => !s)} type="button"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
        {show ? <IcEyeOff /> : <IcEye />}
      </button>
    </div>
  );
}

// == Dialog ==
function Dialog({ title, onClose, onSave, saveLabel = 'Save', saveVariant = 'primary', saving, children }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">{title}</span>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
          {onSave && (
            <button className={`dialog-btn ${saveVariant}`} onClick={onSave} disabled={saving}
              style={saveVariant === 'danger' ? { background: '#e06060', color: '#fff' } : {}}>
              {saving ? 'Saving…' : saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// == Heavy confirm modal — 15s wait + type CONFIRM (used for deleting a user account) ==
function HeavyConfirmModal({ title, targetLabel, targetSub, targetAvatar, warning, onClose, onConfirm, confirming, error }) {
  const WAIT_SECONDS = 15;
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const waitDone   = secondsLeft <= 0;
  const textValid  = confirmText.trim() === 'CONFIRM';
  const canConfirm = waitDone && textValid && !confirming;
  const pct = Math.round(((WAIT_SECONDS - secondsLeft) / WAIT_SECONDS) * 100);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#e06060', display: 'flex' }}><IcAlertTriangle /></span>
            {title}
          </span>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="dialog-body">

          {targetLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(224,96,96,0.08)', border: '1px solid rgba(224,96,96,0.25)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              {targetAvatar}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{targetLabel}</p>
                {targetSub && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{targetSub}</p>}
              </div>
            </div>
          )}

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {warning}
          </p>

          <div>
            <label className="dialog-label">Type CONFIRM to continue</label>
            <input
              className="dialog-input"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="CONFIRM"
              autoFocus
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              <IcClock />
              {waitDone
                ? <span style={{ color: '#4caf50' }}>You can confirm now</span>
                : <span>Please wait <strong style={{ color: 'var(--text-primary)' }}>{secondsLeft}s</strong> before confirming</span>}
            </div>
            <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: waitDone ? '#4caf50' : 'var(--gradient)',
                transition: 'width 1s linear',
              }} />
            </div>
          </div>

          {error && <StatusMsg text={error} type="err" />}
        </div>
        <div className="dialog-footer">
          <button className="dialog-btn secondary" onClick={onClose} disabled={confirming}>Cancel</button>
          <button
            className="dialog-btn danger"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirming ? 'Deleting…' : waitDone ? 'Delete forever' : `Delete forever (${secondsLeft}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// == Mobile slide panel ==
function MobilePanel({ open, title, onBack, children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--bg-primary)',
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      zIndex: 10,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 1,
        background: 'var(--bg-primary)',
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--accent)', display: 'flex', alignItems: 'center',
          padding: '4px 4px 4px 0', marginRight: 4,
        }}>
          <IcChevronLeft />
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div style={{ padding: '16px 16px' }}>{children}</div>
    </div>
  );
}

// Native range slider — drag just works, no event fighting with scroll containers
function DragSlider({ min, max, value, onChange, background }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: 22 }}>
      <style>{`
        .omni-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 22px;
          border-radius: 11px;
          outline: none;
          cursor: pointer;
          background: transparent;
          position: relative;
          z-index: 1;
        }
        .omni-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid rgba(0,0,0,0.2);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        }
        .omni-range:active::-webkit-slider-thumb { cursor: grabbing; }
        .omni-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid rgba(0,0,0,0.2);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        }
        .omni-range::-moz-range-track { background: transparent; border: none; }
      `}</style>
      {/* Coloured track behind the transparent range input */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 11, background,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      }} />
      <input
        type="range"
        className="omni-range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function HslPicker({ value, onChange, label }) {
  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max) {
        case r: h = ((g-b)/d + (g<b?6:0))/6; break;
        case g: h = ((b-r)/d + 2)/6; break;
        default: h = ((r-g)/d + 4)/6;
      }
    }
    return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h/30) % 12;
    const a = s * Math.min(l, 1-l);
    const f = n => l - a*Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
    const toHex = x => Math.round(x*255).toString(16).padStart(2,'0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  const [h, s, l] = hexToHsl(value || '#2952e3');
  const track = (prop, val) => {
    const newH = prop==='h' ? val : h;
    const newS = prop==='s' ? val : s;
    const newL = prop==='l' ? val : l;
    onChange(hslToHex(newH, newS, newL));
  };

  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: value, border: '2px solid var(--border-input)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{value}</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Hue</div>
        <DragSlider min={0} max={360} value={h} onChange={v => track('h', v)}
          background="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Saturation</div>
        <DragSlider min={0} max={100} value={s} onChange={v => track('s', v)}
          background={`linear-gradient(to right, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Lightness</div>
        <DragSlider min={0} max={100} value={l} onChange={v => track('l', v)}
          background={`linear-gradient(to right, #000, hsl(${h},${s}%,50%), #fff)`} />
      </div>
    </div>
  );
}

function OmniLogoPreview({ accentId, customFrom, customTo, presets }) {
  const preset = presets.find(p => p.id === accentId);
  const from = preset?.id === 'custom' ? customFrom : (preset?.from || '#2952e3');
  const to   = preset?.id === 'custom' ? customTo   : (preset?.to   || '#7c3aed');
  const uid  = React.useId().replace(/:/g, '');
  return (
    <svg height="32" viewBox="0 0 240 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`prev-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <text x="0" y="32" fontFamily="'Inter','SF Pro Display',system-ui,sans-serif"
        fontSize="34" fontWeight="800" letterSpacing="-0.5" textLength="236" lengthAdjust="spacingAndGlyphs"
        fill={`url(#prev-${uid})`}>SKEPTICALL</text>
    </svg>
  );
}

// == BANNER CARD — pfp + name inside banner, auto-contrast text ==
function BannerCard({ bannerSrc, avatarSrc, displayName, username, onBannerClick, onAvatarClick }) {
  const [textColor, setTextColor] = React.useState('#ffffff');
  const canvasRef = React.useRef();

  React.useEffect(() => {
    if (!bannerSrc) { setTextColor('#ffffff'); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 80; canvas.height = 40;
        const ctx = canvas.getContext('2d');
        // sample bottom-left region where text sits
        ctx.drawImage(img, 0, img.height * 0.55, img.width, img.height * 0.45, 0, 0, 80, 40);
        const data = ctx.getImageData(0, 0, 80, 40).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        r /= count; g /= count; b /= count;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        setTextColor(brightness > 128 ? '#000000' : '#ffffff');
      } catch { setTextColor('#ffffff'); }
    };
    img.onerror = () => setTextColor('#ffffff');
    img.src = bannerSrc;
  }, [bannerSrc]);

  const shadow = textColor === '#000000'
    ? '0 1px 3px rgba(255,255,255,0.5)'
    : '0 1px 4px rgba(0,0,0,0.8)';

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div
        onClick={onBannerClick}
        style={{
          width: '100%', height: 160,
          background: bannerSrc ? `url(${bannerSrc}) center/cover no-repeat` : 'var(--gradient)',
          isolation: 'isolate',
          mixBlendMode: 'normal',
          position: 'relative', cursor: 'pointer', overflow: 'hidden', borderRadius: 12,
        }}
      >
        {/* Bottom gradient scrim for legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Change banner hint */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.45)', borderRadius: 20,
          padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5,
          color: '#fff', fontSize: 12, fontWeight: 600,
        }}>
          <IcCamera /><span>Change banner</span>
        </div>

        {/* Avatar — bottom-left inside banner */}
        <div
          onClick={e => { e.stopPropagation(); onAvatarClick(); }}
          style={{
            position: 'absolute', bottom: 14, left: 16,
            width: 56, height: 56, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.85)',
            overflow: 'hidden', cursor: 'pointer',
            background: 'var(--bg-hover)', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {avatarSrc
            ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', background: 'var(--gradient)' }}>
                {(displayName || '?')[0].toUpperCase()}
              </div>
          }
          {/* Camera hover overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', opacity: 0, transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}
          >
            <IcCamera />
          </div>
        </div>

        {/* Name + username — right of avatar, bottom */}
        <div style={{ position: 'absolute', bottom: 18, left: 84, pointerEvents: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textColor, textShadow: shadow, lineHeight: 1.2 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 12, color: textColor, textShadow: shadow, opacity: 0.85 }}>
            @{username}
          </div>
        </div>
      </div>
    </div>
  );
}

// == SETTINGS PAGE ==
export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme, accentId, setAccent, ACCENT_PRESETS, currentAccents, themePresetId, setThemePreset, THEME_PRESETS } = useTheme();
  const navigate                     = useNavigate();
  const location                     = useLocation();

  const initialTab = user ? (location.state?.tab || 'profile') : 'appearance';
  const [panel,       setPanel]       = useState(initialTab);
  const [mobilePanel, setMobilePanel] = useState(null);

  // dialogs
  const [dialog,   setDialog]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [dlgMsg,   setDlgMsg]   = useState({ text: '', type: '' });

  // account fields
  const [newUsername,    setNewUsername]    = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail,       setNewEmail]       = useState('');
  const [currentPw,      setCurrentPw]      = useState('');
  const [newPw,          setNewPw]          = useState('');
  const [confirmPw,      setConfirmPw]      = useState('');
  const [deletePw,       setDeletePw]       = useState('');

  // profile
  const [bio,           setBio]           = useState(user?.bio || '');
  const [profileMsg,    setProfileMsg]    = useState({ text: '', type: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const avatarRef = useRef(); const bannerRef = useRef();
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [bannerFile,    setBannerFile]    = useState(null);
  const [editDisplayName, setEditDisplayName] = useState(user?.displayName || '');

  // toggles — initialised from user object
  const [privacyMode,    setPrivacyMode]    = useState(user?.privacyMode    || false);
  const [anonymousMode,  setAnonymousMode]  = useState(user?.anonymousMode  || false);
  const [appearOffline,  setAppearOffline]  = useState(user?.appearOffline  || false);
  const [notifMessages,  setNotifMessages]  = useState(user?.notifMessages  !== false);
  const [notifMentions,  setNotifMentions]  = useState(user?.notifMentions  !== false);
  const [notifFollows,   setNotifFollows]   = useState(user?.notifFollows   !== false);
  const [notifReposts,   setNotifReposts]   = useState(user?.notifReposts   !== false);
  const [profanityFilter,setProfanityFilter]= useState(user?.profanityMode  || false);
  const [ipAlerts,       setIpAlerts]       = useState(user?.ipLoginAlerts  || false);

  // per-toggle saving state so we show a spinner inline
  const [toggling, setToggling] = useState({});

  // admin panel
  const [adminUsers,      setAdminUsers]      = useState([]);
  const [adminLoading,    setAdminLoading]    = useState(false);
  const [adminError,      setAdminError]      = useState('');
  const [adminSearch,     setAdminSearch]     = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState(null); // user object pending heavy-confirm delete
  const [deletingUser,    setDeletingUser]    = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');

  const API_BASE = 'http://localhost:1979';

  // ── helpers ──────────────────────────────────────────────────────
  function openDialog(d) {
    setDialog(d); setDlgMsg({ text: '', type: '' }); setSaving(false);
    setNewUsername(user?.username || '');
    setNewEmail(user?.email || '');
    setCurrentPw(''); setNewPw(''); setConfirmPw(''); setDeletePw('');
  }
  function dlgOk(text)  { setDlgMsg({ text, type: 'ok'  }); }
  function dlgErr(text) { setDlgMsg({ text, type: 'err' }); }

  async function withSave(fn) {
    setSaving(true);
    try { await fn(); }
    finally { setSaving(false); }
  }

  // toggle helper — optimistic UI + API call
  async function toggle(key, val, setter, apiKey) {
    setter(val);
    setToggling(t => ({ ...t, [key]: true }));
    try {
      await api.updateSettings(user.id, { [apiKey || key]: val });
      updateUser({ [apiKey || key]: val });
    } catch {
      setter(!val); // revert on error
    } finally {
      setToggling(t => ({ ...t, [key]: false }));
    }
  }

  // ── account saves ─────────────────────────────────────────────────
  async function saveUsername() {
    if (!newUsername.trim()) { dlgErr('Username cannot be empty.'); return; }
    await withSave(async () => {
      try {
        const updated = await api.updateAccount(user.id, { username: newUsername.trim() });
        updateUser(updated); dlgOk('Username updated!');
        setTimeout(() => setDialog(null), 1000);
      } catch (e) { dlgErr(e.message || 'Failed to update username.'); }
    });
  }

  async function saveEmail() {
    if (!newEmail.trim()) { dlgErr('Email cannot be empty.'); return; }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(newEmail.trim())) { dlgErr('Enter a valid email address.'); return; }
    await withSave(async () => {
      try {
        const updated = await api.updateAccount(user.id, { email: newEmail.trim() });
        updateUser(updated); dlgOk('Email updated!');
        setTimeout(() => setDialog(null), 1000);
      } catch (e) { dlgErr(e.message || 'Failed to update email.'); }
    });
  }

  async function savePassword() {
    if (!currentPw)           { dlgErr('Enter your current password.'); return; }
    if (newPw.length < 6)     { dlgErr('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw)  { dlgErr('Passwords do not match.'); return; }
    await withSave(async () => {
      try {
        await api.updateAccount(user.id, { currentPassword: currentPw, newPassword: newPw });
        dlgOk('Password changed!');
        setTimeout(() => setDialog(null), 1000);
      } catch (e) { dlgErr(e.message || 'Incorrect current password.'); }
    });
  }

  async function confirmDeleteAccount() {
    if (!deletePw) { dlgErr('Enter your password to confirm.'); return; }
    await withSave(async () => {
      try {
        await api.deleteAccount(user.id, deletePw);
        logout(); navigate('/accounts/login');
      } catch (e) { dlgErr(e.message || 'Could not delete account. Check your password.'); }
    });
  }

  // ── admin panel ──────────────────────────────────────────────────
  async function loadAdminUsers() {
    if (!user?.admin) return;
    setAdminLoading(true); setAdminError('');
    try {
      const list = await adminApi.listUsers();
      setAdminUsers(list);
    } catch (e) {
      setAdminError(e.message || 'Failed to load users.');
    } finally {
      setAdminLoading(false);
    }
  }

  function openDeleteUserModal(targetUser) {
    setDeleteUserError('');
    setDeleteUserTarget(targetUser);
  }

  async function confirmDeleteUser() {
    if (!deleteUserTarget) return;
    setDeletingUser(true); setDeleteUserError('');
    try {
      await adminApi.deleteUser(deleteUserTarget.id);
      setAdminUsers(list => list.filter(u => u.id !== deleteUserTarget.id));
      setDeleteUserTarget(null);
    } catch (e) {
      setDeleteUserError(e.message || 'Failed to delete user.');
    } finally {
      setDeletingUser(false);
    }
  }

  async function toggleAdminRole(targetUser) {
    setAdminError('');
    try {
      if (targetUser.admin) {
        await adminApi.revokeAdmin(targetUser.id);
      } else {
        await adminApi.grantAdmin(targetUser.id);
      }
      setAdminUsers(list => list.map(u => u.id === targetUser.id ? { ...u, admin: !u.admin } : u));
    } catch (e) {
      setAdminError(e.message || 'Failed to update admin role.');
    }
  }

  // ── profile save ─────────────────────────────────────────────────
  async function saveProfile() {
    setProfileSaving(true); setProfileMsg({ text: '', type: '' });
    try {
      const fd = new FormData();
      fd.append('displayName', editDisplayName.trim() || user?.displayName || '');
      fd.append('bio', bio.trim());
      if (avatarFile) fd.append('file',   avatarFile);
      if (bannerFile) fd.append('banner', bannerFile);
      const updated = await api.updateProfile(user.id, fd);
      updateUser(updated);
      setAvatarFile(null); setBannerFile(null);
      setProfileMsg({ text: 'Profile saved!', type: 'ok' });
      setTimeout(() => setProfileMsg({ text: '', type: '' }), 3000);
    } catch (e) {
      setProfileMsg({ text: e.message || 'Save failed.', type: 'err' });
    } finally { setProfileSaving(false); }
  }

  // ── sign out ──────────────────────────────────────────────────────
  function signOut() {
    api.setPresence(user.id, false).catch(() => {});
    logout(); navigate('/accounts/login');
  }

  // Load the user roster the moment the admin panel becomes visible (desktop or mobile)
  useEffect(() => {
    if (panel === 'admin' || mobilePanel === 'admin') loadAdminUsers();
  }, [panel, mobilePanel]);

  // Guests only get settings that don't need an account (Appearance is
  // fully localStorage-backed already — see ThemeContext).
  const tabs = !user ? [
    { id: 'appearance', label: 'Appearance', Icon: IcAppearance },
  ] : [
    { id: 'profile',    label: 'Profile',          Icon: IcProfile    },
    { id: 'account',    label: 'Account',          Icon: IcAccount    },
    { id: 'appearance', label: 'Appearance',       Icon: IcAppearance },
    { id: 'privacy',    label: 'Privacy & Safety', Icon: IcPrivacy    },
    { id: 'presence',   label: 'Presence',         Icon: IcPresence   },
    { id: 'notif',      label: 'Notifications',    Icon: IcNotif      },
    { id: 'security',   label: 'Security',         Icon: IcSecurity   },
    ...(user?.admin ? [{ id: 'admin', label: 'Admin', Icon: IcShield }] : []),
  ];

  // ── panel content (shared desktop + mobile) ───────────────────────
  function PanelContent({ id }) {

    if (id === 'account') return (
      <>
        <SectionTitle>Account Info</SectionTitle>
        <AccRow label="Username" value={`@${user?.username}`}  onClick={() => openDialog('username')} />
        <AccRow label="Email"    value={maskedEmail(user?.email)} onClick={() => openDialog('email')} />
        <AccRow label="Password" value="Change password"          onClick={() => openDialog('password')} />
        <SectionTitle mt={28}>Account Management</SectionTitle>
        <AccRow label="Sign Out"       onClick={signOut} />
        <AccRow label="Delete Account" onClick={() => openDialog('deleteAccount')} danger />
      </>
    );

    if (id === 'profile') return (
      <>
        {/* Banner card — pfp + name live inside the banner */}
        <BannerCard
          bannerSrc={bannerPreview || resolveUrl(user?.bannerPicture ? (user.bannerPicture.startsWith('http') ? user.bannerPicture : `${API_BASE}${user.bannerPicture}`) : null)}
          avatarSrc={avatarPreview || resolveUrl(user?.profilePicture ? (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE}${user.profilePicture}`) : null)}
          displayName={user?.displayName || user?.username}
          username={user?.username}
          onBannerClick={() => bannerRef.current.click()}
          onAvatarClick={() => avatarRef.current.click()}
        />
        <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); } }} />
        <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />

        <div style={{ padding: '0 20px' }}>
          <SectionTitle>Display Name</SectionTitle>
          <input className="dialog-input" style={{ marginBottom: 16 }}
            value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)}
            placeholder="Display name" />

          <SectionTitle>Bio</SectionTitle>
          <textarea className="dialog-input"
            style={{ resize: 'vertical', minHeight: 80, marginBottom: 4, fontFamily: 'inherit' }}
            value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell people a bit about yourself…" maxLength={200} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 16 }}>{bio.length}/200</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="dialog-btn primary" onClick={saveProfile} disabled={profileSaving} style={{ minWidth: 120 }}>
              {profileSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
          <StatusMsg text={profileMsg.text} type={profileMsg.type} />
        </div>
      </>
    );

    if (id === 'appearance') return (
      <>
        <SettingRow label="Theme" desc="Switch between dark and light mode">
          <button className="theme-toggle" onClick={toggleTheme}>
            <span className="theme-icon dark-icon">🌙</span>
            <span className="theme-icon light-icon">☀️</span>
            <span className="theme-thumb" />
          </button>
        </SettingRow>

        <SectionTitle mt={24}>Accent Color</SectionTitle>
        <div style={{ padding: '12px 0 4px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(currentAccents || ACCENT_PRESETS).map(preset => (
              <button
                key={preset.id}
                onClick={e => { e.stopPropagation(); setAccent(preset.id); }}
                title={preset.label}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                  outline: accentId === preset.id ? '3px solid var(--text-primary)' : '3px solid transparent',
                  outlineOffset: 2,
                  transition: 'outline 0.15s, transform 0.15s',
                  transform: accentId === preset.id ? 'scale(1.15)' : 'scale(1)',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>
        <SectionTitle mt={24}>App Theme</SectionTitle>
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {THEME_PRESETS.filter(p => theme === 'light' ? p.dark === false : p.dark !== false).map(preset => (
              <button
                key={preset.id}
                onClick={() => setThemePreset(preset.id)}
                title={preset.label}
                style={{
                  width: 76, borderRadius: 10,
                  border: themePresetId === preset.id ? '2px solid var(--accent)' : '2px solid transparent',
                  outline: '1px solid var(--border-input)', cursor: 'pointer',
                  background: 'var(--bg-input)', padding: 0, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                  transform: themePresetId === preset.id ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.15s, border 0.15s',
                }}
              >
                <div style={{ height: 52, background: preset.swatch }} />
                <div style={{ fontSize: 10, fontWeight: 600, padding: '5px 4px', color: 'var(--text-primary)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {preset.label}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {theme === 'light' ? 'Showing light themes. Switch to dark mode to see dark themes.' : 'Showing dark themes. Switch to light mode to see light themes.'}
        </div>

        <SectionTitle mt={24}>Font Size</SectionTitle>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {['Small', 'Default', 'Large'].map(size => (
            <button key={size} className={`settings-chip${size === 'Default' ? ' active' : ''}`}
              style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Coming soon">{size}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Font size customization — coming soon</div>
      </>
    );

    if (id === 'privacy') return (
      <>
        <SectionTitle>Profile Visibility</SectionTitle>
        <SettingRow label="Privacy Mode" desc="Hide your profile from search results and suggestions.">
          <ToggleSwitch
            checked={privacyMode}
            disabled={toggling.privacyMode}
            onChange={val => toggle('privacyMode', val, setPrivacyMode, 'privacyMode').then(() => {
              // privacy uses its own endpoint
              api.updatePrivacy(user.id, val).catch(() => {});
            })}
          />
        </SettingRow>
        <SettingRow label="Anonymous Mode" desc="Your username is hidden in public posts. Appears as 'Anonymous'." noBorder>
          <ToggleSwitch
            checked={anonymousMode}
            disabled={toggling.anonymousMode}
            onChange={val => toggle('anonymousMode', val, setAnonymousMode)}
          />
        </SettingRow>
        <SectionTitle mt={24}>Legal</SectionTitle>
        <AccRow label="Terms of Service" onClick={() => navigate('/terms')} />
        <AccRow label="Privacy Policy"   onClick={() => navigate('/privacy-policy')} />
      </>
    );

    if (id === 'presence') return (
      <>
        <SettingRow label="Appear Offline" desc="Show as offline to everyone even when you are active. Your messages will still be delivered.">
          <ToggleSwitch
            checked={appearOffline}
            disabled={toggling.appearOffline}
            onChange={async val => {
              setAppearOffline(val);
              setToggling(t => ({ ...t, appearOffline: true }));
              try {
                await api.updateSettings(user.id, { appearOffline: val });
                await api.setPresence(user.id, !val);
                updateUser({ appearOffline: val });
              } catch {
                setAppearOffline(!val);
              } finally {
                setToggling(t => ({ ...t, appearOffline: false }));
              }
            }}
          />
        </SettingRow>
        <div style={{ margin: '24px 20px 0', padding: '14px 16px', background: 'var(--bg-hover)', borderRadius: 10, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>How presence works</strong><br />
          Skepticall broadcasts your online status when you are active in the app. Toggling "Appear Offline" stops that broadcast immediately without disconnecting you.
        </div>
      </>
    );

    if (id === 'notif') return (
      <>
        <SectionTitle>Messages &amp; Calls</SectionTitle>
        <SettingRow label="Direct Messages" desc="Get notified when someone sends you a message.">
          <ToggleSwitch checked={notifMessages} disabled={toggling.notifMessages}
            onChange={val => toggle('notifMessages', val, setNotifMessages)} />
        </SettingRow>
        <SectionTitle mt={20}>Social</SectionTitle>
        <SettingRow label="Mentions" desc="Notify when someone mentions you in a post or comment.">
          <ToggleSwitch checked={notifMentions} disabled={toggling.notifMentions}
            onChange={val => toggle('notifMentions', val, setNotifMentions)} />
        </SettingRow>
        <SettingRow label="New Followers" desc="Notify when someone starts following you.">
          <ToggleSwitch checked={notifFollows} disabled={toggling.notifFollows}
            onChange={val => toggle('notifFollows', val, setNotifFollows)} />
        </SettingRow>
        <SettingRow label="Reposts" desc="Notify when someone reposts your content." noBorder>
          <ToggleSwitch checked={notifReposts} disabled={toggling.notifReposts}
            onChange={val => toggle('notifReposts', val, setNotifReposts)} />
        </SettingRow>
        <div style={{ marginTop: 20, padding: '0 20px', fontSize: 11, color: 'var(--text-muted)' }}>
          Push notification delivery depends on browser permissions and device settings.
        </div>
      </>
    );

    if (id === 'security') return (
      <>
        <SectionTitle>Content</SectionTitle>
        <SettingRow label="Profanity Filter" desc="Automatically censor profanity in messages and posts you receive.">
          <ToggleSwitch checked={profanityFilter} disabled={toggling.profanityFilter}
            onChange={val => toggle('profanityFilter', val, setProfanityFilter, 'profanityMode')} />
        </SettingRow>
        <SectionTitle mt={20}>Login &amp; Access</SectionTitle>
        <SettingRow label="IP Login Alerts" desc="Email alert when your account is accessed from a new or unrecognised IP address.">
          <ToggleSwitch checked={ipAlerts} disabled={toggling.ipAlerts}
            onChange={val => toggle('ipAlerts', val, setIpAlerts, 'ipLoginAlerts')} />
        </SettingRow>
        <SettingRow label="Two-Factor Authentication" desc="Require a verification code on sign-in. (Coming soon)" noBorder>
          <ToggleSwitch checked={false} disabled onChange={() => {}} />
        </SettingRow>
        <SectionTitle mt={20}>Sessions</SectionTitle>
        <div className="acc-row" onClick={signOut}>
          <span className="acc-row-label">Sign out of all devices</span>
          <span className="acc-row-value"><IcChevron /></span>
        </div>
        {(user?.lastLoginAt || user?.lastLoginIp) && (
          <>
            <SectionTitle mt={20}>Account History</SectionTitle>
            {user.lastLoginAt && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Last sign-in: </span>
                {new Date(user.lastLoginAt).toLocaleString()}
              </div>
            )}
            {user.lastLoginIp && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 20px' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Last IP: </span>{user.lastLoginIp}
              </div>
            )}
          </>
        )}
      </>
    );

    if (id === 'admin') {
      const filteredUsers = adminUsers.filter(u => {
        const q = adminSearch.trim().toLowerCase();
        if (!q) return true;
        return (u.username || '').toLowerCase().includes(q)
          || (u.displayName || '').toLowerCase().includes(q)
          || (u.email || '').toLowerCase().includes(q);
      });

      return (
        <>
          <SectionTitle>Moderation</SectionTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
            As an admin you can delete any user's posts, comments, and media directly from the
            content itself. Deleting a user account requires a 15-second wait and typing CONFIRM.
          </p>

          <div style={{ position: 'relative', marginBottom: 12 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
              <IcSearch />
            </span>
            <input
              className="dialog-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search users by username, name, or email…"
              value={adminSearch}
              onChange={e => setAdminSearch(e.target.value)}
            />
          </div>

          {adminError && <StatusMsg text={adminError} type="err" />}

          {adminLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading users…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredUsers.map(u => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--bg-hover)',
                }}>
                  <UserAvatar src={u.profilePicture} name={u.displayName || u.username} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.displayName || u.username}
                      </span>
                      {u.admin && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                          background: 'var(--accent-glow)', borderRadius: 6, padding: '1px 6px',
                          display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                        }}>
                          <IcShield />ADMIN
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.username}</span>
                  </div>
                  <button
                    className="settings-chip"
                    onClick={() => toggleAdminRole(u)}
                    disabled={u.id === user.id}
                    title={u.id === user.id ? "You can't change your own admin role here" : ''}
                    style={{ fontSize: 11, opacity: u.id === user.id ? 0.4 : 1, cursor: u.id === user.id ? 'not-allowed' : 'pointer' }}
                  >
                    {u.admin ? 'Revoke admin' : 'Make admin'}
                  </button>
                  <button
                    onClick={() => openDeleteUserModal(u)}
                    disabled={u.id === user.id}
                    title={u.id === user.id ? "You can't delete your own account here" : 'Delete user'}
                    style={{
                      background: 'none', border: 'none', cursor: u.id === user.id ? 'not-allowed' : 'pointer',
                      color: '#e06060', display: 'flex', padding: 6, borderRadius: 8,
                      opacity: u.id === user.id ? 0.35 : 1,
                    }}
                  >
                    <IcTrash />
                  </button>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No users found.</div>
              )}
            </div>
          )}
        </>
      );
    }

    return null;
  }

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
      <style>{`
        @media (max-width: 768px) {
          .settings-mobile-root { display: block !important; }
          .settings-layout      { display: none !important; }
          .settings-desktop-header { display: none !important; }
        }
        @media (min-width: 769px) {
          .settings-mobile-root { display: none !important; }
          .settings-layout      { display: flex !important; }
          .settings-desktop-header { display: block !important; }
        }
        .settings-mobile-list { flex-direction: column; padding: 8px 0; overflow-y: auto; flex: 1; }
        .settings-mobile-item {
          display: flex; align-items: center; gap: 14px;
          padding: 15px 20px; border-bottom: 1px solid var(--border);
          cursor: pointer; background: none; border-left: none; border-right: none; border-top: none;
          width: 100%; text-align: left; color: var(--text-primary); transition: background 0.12s;
        }
        .settings-mobile-item:active { background: var(--bg-hover); }
        .settings-mobile-item-icon {
          width: 36px; height: 36px; border-radius: 10px; background: var(--bg-hover);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent);
        }
        .settings-mobile-item-label { flex: 1; font-size: 15px; font-weight: 500; }
        .settings-mobile-item-chevron { color: var(--text-muted); }
        .settings-mobile-danger .settings-mobile-item-icon { color: #e06060; }
        .settings-mobile-danger .settings-mobile-item-label { color: #e06060; }
      `}</style>


      {/* ── MOBILE layout ── */}
      <div className="settings-mobile-root" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Mobile list page */}
        <div style={{
          position: 'absolute', inset: 0,
          overflowY: 'auto',
          background: 'var(--bg-primary)',
          visibility: mobilePanel ? 'hidden' : 'visible',
          transition: 'visibility 0.28s',
        }}>
          {/* Mobile header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</span>
          </div>
          {!user && (
            <div style={{ margin: '12px 16px', padding: '12px 14px', borderRadius: 10, background: 'var(--bg-hover)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You're browsing as a guest. Log in to unlock your profile, account, and notification settings.
            </div>
          )}
          <div style={{ padding: '8px 0' }}>
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} className="settings-mobile-item" onClick={() => setMobilePanel(id)}>
                <div className="settings-mobile-item-icon"><Icon /></div>
                <span className="settings-mobile-item-label">{label}</span>
                <span className="settings-mobile-item-chevron"><IcChevron /></span>
              </button>
            ))}
            <div style={{ height: 8, background: 'var(--bg-hover)', margin: '8px 0' }} />
            {user ? (
              <>
                <button className="settings-mobile-item" onClick={signOut}>
                  <div className="settings-mobile-item-icon" style={{ color: 'var(--text-muted)' }}><IcSignOut /></div>
                  <span className="settings-mobile-item-label">Sign Out</span>
                </button>
                <button className="settings-mobile-item settings-mobile-danger" onClick={() => openDialog('deleteAccount')}>
                  <div className="settings-mobile-item-icon"><IcTrash /></div>
                  <span className="settings-mobile-item-label">Delete Account</span>
                </button>
              </>
            ) : (
              <button className="settings-mobile-item" onClick={() => navigate('/accounts/login')}>
                <div className="settings-mobile-item-icon" style={{ color: 'var(--accent)' }}><IcSignOut /></div>
                <span className="settings-mobile-item-label">Log in / Sign up</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile slide-in section panel */}
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-primary)',
          overflowY: 'auto',
          transform: mobilePanel ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 200,
        }}>
          {/* Panel sticky header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky', top: 0, zIndex: 1,
            background: 'var(--bg-primary)',
          }}>
            <button onClick={() => setMobilePanel(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', display: 'flex', alignItems: 'center',
              padding: '4px 4px 4px 0', marginRight: 4,
            }}>
              <IcChevronLeft />
            </button>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {tabs.find(t => t.id === mobilePanel)?.label || ''}
            </span>
          </div>
          <div style={{ padding: '16px 16px' }}>
            {mobilePanel && <PanelContent id={mobilePanel} />}
          </div>
        </div>

      </div>

      {/* ── DESKTOP layout ── */}
      <div className="settings-layout" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* Desktop left nav */}
        <div className="settings-nav">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} className={`settings-nav-btn${panel === id ? ' active' : ''}`} onClick={() => setPanel(id)}>
              <Icon />{label}
            </button>
          ))}
          <div className="settings-nav-spacer" />
          <div className="settings-divider" />
          {user ? (
            <>
              <button className="settings-nav-btn" onClick={signOut}><IcSignOut />Sign Out</button>
              <button className="settings-nav-btn danger" onClick={() => openDialog('deleteAccount')}><IcTrash />Delete Account</button>
            </>
          ) : (
            <button className="settings-nav-btn" onClick={() => navigate('/accounts/login')}><IcSignOut />Log in / Sign up</button>
          )}
        </div>

        {/* Desktop content */}
        <div className="settings-content">
          <h2 className="settings-panel-title">{tabs.find(t => t.id === panel)?.label}</h2>
          {!user && (
            <div style={{ margin: '0 0 20px', padding: '12px 14px', borderRadius: 10, background: 'var(--bg-hover)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You're browsing as a guest. Log in to unlock your profile, account, and notification settings.
            </div>
          )}
          <PanelContent id={panel} />
        </div>

      </div>

      {/* ── DIALOGS ── */}

      {dialog === 'username' && (
        <Dialog title="Change Username" onClose={() => setDialog(null)} onSave={saveUsername} saving={saving}>
          <label className="dialog-label">New Username</label>
          <input className="dialog-input" value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus
            placeholder={user?.username} />
          <StatusMsg text={dlgMsg.text} type={dlgMsg.type} />
        </Dialog>
      )}

      {dialog === 'email' && (
        <Dialog title="Change Email" onClose={() => setDialog(null)} onSave={saveEmail} saving={saving}>
          <label className="dialog-label">New Email Address</label>
          <input className="dialog-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
            autoFocus placeholder={user?.email || 'you@example.com'} />
          <StatusMsg text={dlgMsg.text} type={dlgMsg.type} />
        </Dialog>
      )}

      {dialog === 'password' && (
        <Dialog title="Change Password" onClose={() => setDialog(null)} onSave={savePassword} saving={saving}>
          <label className="dialog-label">Current Password</label>
          <PwInput value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoFocus />
          <label className="dialog-label" style={{ marginTop: 12 }}>New Password</label>
          <PwInput value={newPw} onChange={e => setNewPw(e.target.value)} />
          {newPw && (
            <div style={{ fontSize: 11, color: newPw.length < 6 ? '#e06060' : '#4caf50', marginTop: 4, marginBottom: 4 }}>
              {newPw.length < 6 ? `${6 - newPw.length} more character${6 - newPw.length !== 1 ? 's' : ''} needed` : '✓ Strong enough'}
            </div>
          )}
          <label className="dialog-label" style={{ marginTop: 12 }}>Confirm New Password</label>
          <PwInput value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          {confirmPw && newPw !== confirmPw && (
            <div style={{ fontSize: 11, color: '#e06060', marginTop: 4 }}>Passwords don't match</div>
          )}
          <StatusMsg text={dlgMsg.text} type={dlgMsg.type} />
        </Dialog>
      )}

      {dialog === 'deleteAccount' && (
        <Dialog title="Delete Account" onClose={() => setDialog(null)} onSave={confirmDeleteAccount}
          saveLabel="Delete Forever" saveVariant="danger" saving={saving}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 14px' }}>
            This action is <strong>permanent</strong> and cannot be undone. All your posts, messages, and media will be deleted immediately.
          </p>
          <label className="dialog-label">Enter your password to confirm</label>
          <PwInput value={deletePw} onChange={e => setDeletePw(e.target.value)} autoFocus />
          <StatusMsg text={dlgMsg.text} type={dlgMsg.type} />
        </Dialog>
      )}

      {deleteUserTarget && (
        <HeavyConfirmModal
          title="Delete user account"
          targetLabel={deleteUserTarget.displayName || deleteUserTarget.username}
          targetSub={`@${deleteUserTarget.username}`}
          targetAvatar={<UserAvatar src={deleteUserTarget.profilePicture} name={deleteUserTarget.displayName || deleteUserTarget.username} size={32} />}
          warning="This permanently deletes this user's account, posts, comments, and media. This cannot be undone."
          onClose={() => setDeleteUserTarget(null)}
          onConfirm={confirmDeleteUser}
          confirming={deletingUser}
          error={deleteUserError}
        />
      )}
    </div>
  );
}