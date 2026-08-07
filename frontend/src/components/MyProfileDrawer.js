import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE } from '../services/api';

function avatarSrc(pic) {
  if (!pic) return null;
  return pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
}
function bannerSrc(pic) {
  if (!pic) return null;
  return pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
}

function DefaultAvatar({ size = 72, name = '' }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #4facfe, #00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

/* ── Avatar Crop Modal ───────────────────────────────────────────────── */
function AvatarCropModal({ imageSrc, onConfirm, onCancel }) {
  const [scale,  setScale]  = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const canvasRef = useRef(null);
  const SIZE = 280;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      // Draw image
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, offset.x + (SIZE - w) / 2, offset.y + (SIZE - h) / 2, w, h);
      // Circular clip overlay (darken outside)
      ctx.save();
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      // Dark outside
      ctx.rect(0, 0, SIZE, SIZE);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.evenOddFill = true;
      ctx.fill('evenodd');
      // Circle border
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.strokeStyle = '#4facfe';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    };
    img.src = imageSrc;
  }, [imageSrc, scale, offset]);

  React.useEffect(() => { draw(); }, [draw]);

  function onMouseDown(e) {
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }
  function onMouseMove(e) {
    if (!dragging || !dragStart.current) return;
    setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }
  function onMouseUp() { setDragging(false); }

  function onTouchStart(e) {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { x: t.clientX - offset.x, y: t.clientY - offset.y };
  }
  function onTouchMove(e) {
    if (!dragging || !dragStart.current) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.current.x, y: t.clientY - dragStart.current.y });
  }

  async function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Produce final circular crop as blob
    const out = document.createElement('canvas');
    out.width = 256; out.height = 256;
    const ctx = out.getContext('2d');
    // Clip to circle
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.clip();
    // Scale coordinates from SIZE→256
    const ratio = 256 / SIZE;
    const img = new window.Image();
    img.onload = () => {
      const w = img.width * scale * ratio;
      const h = img.height * scale * ratio;
      ctx.drawImage(img, (offset.x + (SIZE - img.width * scale) / 2) * ratio,
                        (offset.y + (SIZE - img.height * scale) / 2) * ratio, w, h);
      out.toBlob(blob => {
        if (blob) onConfirm(blob, URL.createObjectURL(blob));
      }, 'image/jpeg', 0.92);
    };
    img.src = imageSrc;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Crop Profile Picture</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Drag to reposition · Scroll or use slider to zoom</div>

        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          style={{ borderRadius: 14, cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
          onWheel={e => { e.preventDefault(); setScale(s => Math.min(4, Math.max(0.3, s - e.deltaY * 0.002))); }}
        />

        {/* Zoom slider */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔍</span>
          <input type="range" min={0.3} max={4} step={0.02} value={scale}
            onChange={e => setScale(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(scale * 100)}%</span>
        </div>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid var(--border-input)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={confirm} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Drawer ─────────────────────────────────────────────────────── */
export default function MyProfileDrawer({ onClose }) {
  const { user, updateUser } = useAuth();

  const fileInputRef   = useRef(null);
  const bannerInputRef = useRef(null);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio,         setBio]         = useState(user?.bio || '');

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState(avatarSrc(user?.profilePicture));
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [cropSrc,       setCropSrc]       = useState(null); // raw src for crop modal

  // Banner
  const [bannerPreview, setBannerPreview] = useState(bannerSrc(user?.bannerPicture));
  const [bannerFile,    setBannerFile]    = useState(null);

  const [saving, setSaving]   = useState(false);
  const [msg,    setMsg]      = useState({ text: '', type: '' });

  /* ── Avatar pick → open crop modal ── */
  function pickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
  }

  function onCropConfirm(blob, previewUrl) {
    setAvatarPreview(previewUrl);
    setAvatarFile(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    setCropSrc(null);
  }

  /* ── Banner pick ── */
  function pickBanner(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = ev => setBannerPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true); setMsg({ text: '', type: '' });
    try {
      const fd = new FormData();
      fd.append('displayName', displayName.trim());
      fd.append('bio', bio.trim());
      if (avatarFile) fd.append('file', avatarFile);
      if (bannerFile) fd.append('banner', bannerFile);
      const updated = await api.updateProfile(user.id, fd);
      updateUser(updated);
      setMsg({ text: 'Profile saved!', type: 'ok' });
      setTimeout(onClose, 900);
    } catch (e) {
      setMsg({ text: e.message || 'Save failed', type: 'err' });
    } finally {
      setSaving(false);
    }
  }

  const bannerBg = bannerPreview ? `url(${bannerPreview}) center/cover` : 'linear-gradient(135deg,#1a3a5c,#0f2040)';

  return (
    <>
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={onCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 900 }} />

      {/* Drawer */}
      <div style={{ position: 'fixed', top: 0, right: 0, width: 340, height: '100vh', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 901, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Profile</span>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Banner */}
          <div style={{ position: 'relative', height: 110, background: bannerBg, flexShrink: 0 }}>
            <button
              onClick={() => bannerInputRef.current?.click()}
              title="Change banner"
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 6, fontSize: 13, fontWeight: 600 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Change Banner
            </button>
            <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickBanner} />
          </div>

          {/* Avatar picker (overlapping banner) */}
          <div style={{ padding: '0 20px', marginTop: -36, marginBottom: 8, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => fileInputRef.current?.click()}>
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--bg-card)' }} />
                : <DefaultAvatar size={80} name={user?.displayName || user?.username} />
              }
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: '0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="20" height="20"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6 }}>
              Click avatar to change<br/>Drag &amp; zoom to crop
            </div>
          </div>

          {/* Fields */}
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>DISPLAY NAME</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>BIO</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell us about yourself…"
                rows={3}
                style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {msg.text && (
              <div style={{ fontSize: 13, color: msg.type === 'ok' ? '#4caf50' : '#e06060', fontWeight: 500 }}>{msg.text}</div>
            )}

            <button onClick={save} disabled={saving} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1, width: '100%' }}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
