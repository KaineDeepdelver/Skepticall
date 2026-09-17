import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { networkApi, resolveUrl, API_BASE } from '../../services/api';
import ConfirmModal from '../ConfirmModal';
import UserAvatar from '../UserAvatar';
import NetworkUserPopover from './NetworkUserPopover';

// This mirrors Discord's server-settings layout, but only the tabs backed by
// a real endpoint (Members, Roles, Invites, Server Profile, Access, Safety
// Setup, Bans) are functional. Everything else in the nav (Server Tag,
// Emoji, Stickers, Soundboard, Integrations, App Directory, Audit Log,
// AutoMod, Enable Community, Server Template) is a placeholder — none of
// those systems exist yet.




function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', flexShrink: 0,
        background: checked ? '#3ba55d' : 'var(--bg-input)', position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background-color 0.15s ease',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

function SettingRow({ label, desc, checked, onChange, disabled, children }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
          {desc && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{desc}</div>}
        </div>
        {onChange && <Toggle checked={checked} onChange={onChange} disabled={disabled} />}
      </div>
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 42, marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.3 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, maxWidth: 340, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
  );
}

// Same clipping problem/fix as ChannelSidebar's AnchoredMenu: this panel's
// content column is `overflow: auto`, so any popover anchored with
// `position: absolute` inside it can get clipped once the page scrolls.
// Anchoring with `position: fixed` off the trigger's real screen coordinates
// sidesteps the container entirely.
function AnchoredMenu({ anchorRef, onClose, align = 'left', width, children }) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
  }, [anchorRef]);

  if (!rect) return null;

  const margin = 8;
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
  const maxHeight = openUp ? spaceAbove : spaceBelow;

  const style = {
    position: 'fixed', zIndex: 600,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
    boxShadow: '0 8px 28px rgba(0,0,0,0.45)', padding: 6,
    maxHeight, overflowY: 'auto',
    width: width || rect.width,
    ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    ...(align === 'right' ? { left: rect.right - (width || rect.width) } : { left: rect.left }),
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 599 }} />
      <div onClick={e => e.stopPropagation()} style={style}>
        {children}
      </div>
    </>
  );
}

const ICONS = {
  kebab: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  pencil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  person: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  chevronRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="9 18 15 12 9 6" /></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="13" height="13"><polyline points="20 6 9 17 4 12" /></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
};

const NAV = [
  { group: (network) => (network.name || '').toUpperCase(), items: [
    { key: 'profile', label: 'Server Profile', available: true },
    { key: 'tag', label: 'Server Tag', available: true },
    { key: 'engagement', label: 'Engagement', available: true },
    { key: 'boosts', label: 'Boost Perks', available: false },
  ]},
  { group: () => 'Expression', items: [
    { key: 'emoji', label: 'Emoji', available: true },
    { key: 'stickers', label: 'Stickers', available: true },
    { key: 'soundboard', label: 'Soundboard', available: true },
  ]},
  { group: () => 'People', items: [
    { key: 'members', label: 'Members', available: true },
    { key: 'roles', label: 'Roles', available: true },
    { key: 'invites', label: 'Invites', available: true },
    { key: 'access', label: 'Access', available: true },
  ]},
  { group: () => 'Apps', items: [
    { key: 'integrations', label: 'Integrations', available: true },
    { key: 'appdirectory', label: 'App Directory', available: false, external: true },
  ]},
  { group: () => 'Moderation', items: [
    { key: 'safety', label: 'Safety Setup', available: true },
    { key: 'auditlog', label: 'Audit Log', available: true },
    { key: 'bans', label: 'Bans', available: true },
    { key: 'automod', label: 'AutoMod', available: true },
  ]},
];

function NavItem({ label, active, available, external, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={available ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '7px 10px', borderRadius: 4, border: 'none', textAlign: 'left',
        background: active ? 'var(--bg-hover)' : (hovered && available ? 'var(--bg-hover)' : 'transparent'),
        color: active ? 'var(--text-primary)' : (available ? 'var(--text-secondary)' : 'var(--text-muted)'),
        fontSize: 14.5, fontWeight: active ? 600 : 500, cursor: available ? 'pointer' : 'default',
        opacity: available ? 1 : 0.55,
      }}
    >
      <span>{label}</span>
      {external && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>}
      {!available && !external && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, background: 'var(--bg-input)', borderRadius: 3, padding: '2px 5px' }}>SOON</span>}
    </button>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '14px 10px 6px' }}>{children}</div>;
}

function ComingSoon({ label }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>{label}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        This section isn't wired up yet — there's no backend support for it. Coming down the line.
      </p>
    </div>
  );
}

// ── Reusable photo upload + reposition/zoom adjuster ────────────────────
//
// There's no image storage endpoint on the backend yet, so this whole thing
// stays client-side: the file is read into a data URL and the crop (offset +
// zoom) is stored as plain numbers, never uploaded anywhere. Offset is stored
// as a FRACTION of the frame size (not raw px) specifically so the same crop
// still looks right when re-rendered at a different size elsewhere (the big
// editor preview vs. the small settings-card preview vs. wherever else).

// Empty-state banner needs to read as clearly "banner-shaped" even against
// dark themes — a subtle bg-input/bg-hover blend was nearly invisible
// against the card body, which made the avatar look like it was floating in
// a blank box rather than overlapping a banner.
const EMPTY_BANNER_BG = 'linear-gradient(135deg, var(--accent) 0%, #ff6fd8 100%)';

function coverSize(natW, natH, frameW, frameH) {
  const scale = Math.max(frameW / natW, frameH / natH);
  return { w: natW * scale, h: natH * scale };
}

// Renders the exact crop the person saw in the adjuster onto an offscreen
// canvas at frameW×frameH, so what actually gets uploaded matches the
// preview pixel-for-pixel instead of uploading the untouched original file.
function cropToBlob(image, frameW, frameH) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = frameW;
    canvas.height = frameH;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const { w, h } = coverSize(image.naturalW, image.naturalH, frameW, frameH);
      const renderW = w * image.zoom;
      const renderH = h * image.zoom;
      const x = frameW / 2 - renderW / 2 + image.offsetX * frameW;
      const y = frameH / 2 - renderH / 2 + image.offsetY * frameH;
      ctx.drawImage(img, x, y, renderW, renderH);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Crop failed')), 'image/png', 0.92);
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = image.dataUrl;
  });
}

function AdjustableImage({ image, width, height, shape = 'rect', radius = 8, fallback }) {
  if (!image) return fallback || null;
  const { w, h } = coverSize(image.naturalW, image.naturalH, width, height);
  const renderW = w * image.zoom;
  const renderH = h * image.zoom;
  return (
    <div style={{ width, height, overflow: 'hidden', position: 'relative', borderRadius: shape === 'circle' ? '50%' : radius, flexShrink: 0 }}>
      <img
        src={image.dataUrl}
        alt=""
        style={{
          position: 'absolute', width: renderW, height: renderH, maxWidth: 'none',
          left: '50%', top: '50%',
          transform: `translate(-50%, -50%) translate(${image.offsetX * width}px, ${image.offsetY * height}px)`,
        }}
      />
    </div>
  );
}

function ImageAdjustModal({ file, shape, frameW, frameH, title, onCancel, onApply }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // fractions of frame size
  const dragRef = useRef(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setDataUrl(reader.result);
    reader.readAsDataURL(file);
  }, [file]);

  function clampOffset(o, z) {
    if (!natural) return o;
    const { w, h } = coverSize(natural.w, natural.h, frameW, frameH);
    const rw = w * z, rh = h * z;
    const maxX = Math.max(0, (rw - frameW) / 2) / frameW;
    const maxY = Math.max(0, (rh - frameH) / 2) / frameH;
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
  }

  function onImgLoad(e) {
    setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight });
  }

  function onZoomChange(z) {
    setZoom(z);
    setOffset(o => clampOffset(o, z));
  }

  function onPointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, start: offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / frameW;
    const dy = (e.clientY - dragRef.current.startY) / frameH;
    setOffset(clampOffset({ x: dragRef.current.start.x + dx, y: dragRef.current.start.y + dy }, zoom));
  }
  function onPointerUp() { dragRef.current = null; }

  const ready = dataUrl && natural;
  const { w: coverW, h: coverH } = ready ? coverSize(natural.w, natural.h, frameW, frameH) : { w: 0, h: 0 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 'min(90vw, 480px)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{title}</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px' }}>Drag to reposition, use the slider to zoom.</p>

        <div
          onPointerDown={ready ? onPointerDown : undefined}
          onPointerMove={ready ? onPointerMove : undefined}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: frameW, height: frameH, maxWidth: '100%', margin: '0 auto', position: 'relative', overflow: 'hidden',
            background: 'var(--bg-input)', borderRadius: shape === 'circle' ? 12 : 10, cursor: ready ? 'grab' : 'default',
            touchAction: 'none',
          }}
        >
          {!ready && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
          {dataUrl && (
            <img
              src={dataUrl}
              onLoad={onImgLoad}
              draggable={false}
              alt=""
              style={{
                position: 'absolute', width: coverW * zoom, height: coverH * zoom, maxWidth: 'none',
                left: '50%', top: '50%',
                transform: `translate(-50%, -50%) translate(${offset.x * frameW}px, ${offset.y * frameH}px)`,
                pointerEvents: 'none',
              }}
            />
          )}
          {shape === 'circle' && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
              boxShadow: '0 0 0 2000px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.9)',
            }} />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => onZoomChange(Number(e.target.value))} disabled={!ready} style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 16, flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="11" y1="8" x2="11" y2="14" /></svg>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button
            disabled={!ready}
            onClick={() => onApply({ dataUrl, naturalW: natural.w, naturalH: natural.h, zoom, offsetX: offset.x, offsetY: offset.y })}
            style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: 13, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.5 }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// A "Change X" button + hidden file input + the adjust-modal wiring, shared
// between the banner and icon pickers below.
function ImagePickerButton({ label, shape, frameW, frameH, onApply, disabled }) {
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);

  return (
    <>
      <input
        ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.target.value = ''; }}
      />
      <button
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, fontSize: 13.5, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
      >
        {label}
      </button>
      {pendingFile && (
        <ImageAdjustModal
          file={pendingFile}
          shape={shape}
          frameW={frameW}
          frameH={frameH}
          title={label}
          onCancel={() => setPendingFile(null)}
          onApply={img => { onApply(img); setPendingFile(null); }}
        />
      )}
    </>
  );
}

// ── Server Profile ──────────────────────────────────────────────────────

function ServerProfileTab({ network, onNetworkUpdated, bannerImage, setBannerImage, iconImage, setIconImage }) {
  const [traits, setTraits] = useState(['', '', '', '', '']);
  const [gameQuery, setGameQuery] = useState('');
  const [name, setName] = useState(network.name);
  const [description, setDescription] = useState(network.description || '');
  const [savingName, setSavingName] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [error, setError] = useState('');
  const [iconUploading, setIconUploading] = useState(false);
  const [iconError, setIconError] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState('');

  const ICON_FRAME = 280;
  const BANNER_FRAME_W = 480;
  const BANNER_FRAME_H = 150;

  async function save(patch) {
    setError('');
    try {
      const updated = await networkApi.updateNetwork(network.id, patch);
      onNetworkUpdated(updated);
      return updated;
    } catch (e) {
      setError(e.message || 'Failed to save.');
      throw e;
    }
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === network.name) { setName(network.name); return; }
    setSavingName(true);
    try { await save({ name: trimmed }); } catch { setName(network.name); } finally { setSavingName(false); }
  }

  async function saveDescription() {
    if (description === (network.description || '')) return;
    setSavingDesc(true);
    try { await save({ description }); } finally { setSavingDesc(false); }
  }

  async function togglePrivate(checked) {
    try { await save({ privateProfile: checked }); } catch { /* error already surfaced */ }
  }

  async function handleIconApply(img) {
    setIconImage(img); // instant local preview while the upload is in flight
    setIconUploading(true);
    setIconError('');
    try {
      const blob = await cropToBlob(img, ICON_FRAME, ICON_FRAME);
      const fd = new FormData();
      fd.append('file', blob, 'icon.png');
      const updated = await networkApi.updateIcon(network.id, fd);
      onNetworkUpdated(updated);
      setIconImage(null); // now sourced from network.iconUrl, which persists
    } catch (e) {
      setIconError(e.message || 'Failed to upload icon.');
    } finally {
      setIconUploading(false);
    }
  }

  async function handleIconRemove() {
    setIconImage(null);
    setIconError('');
    if (!network.iconUrl) return;
    try {
      const updated = await networkApi.removeIcon(network.id);
      onNetworkUpdated(updated);
    } catch (e) {
      setIconError(e.message || 'Failed to remove icon.');
    }
  }

  async function handleBannerApply(img) {
    setBannerImage(img);
    setBannerUploading(true);
    setBannerError('');
    try {
      const blob = await cropToBlob(img, BANNER_FRAME_W, BANNER_FRAME_H);
      const fd = new FormData();
      fd.append('file', blob, 'banner.png');
      const updated = await networkApi.updateBanner(network.id, fd);
      onNetworkUpdated(updated);
      setBannerImage(null);
    } catch (e) {
      setBannerError(e.message || 'Failed to upload banner.');
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleBannerRemove() {
    setBannerImage(null);
    setBannerError('');
    if (!network.bannerUrl) return;
    try {
      const updated = await networkApi.removeBanner(network.id);
      onNetworkUpdated(updated);
    } catch (e) {
      setBannerError(e.message || 'Failed to remove banner.');
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>Server Profile</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 24 }}>
        Customize how your server appears in invite links and, if enabled, in Server Discovery and Announcement Channel messages.
      </p>

      {error && <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)', marginBottom: 16 }}>{error}</div>}

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Name</label>
      <input
        className="auth-input" style={{ marginTop: 8, marginBottom: 4 }}
        value={name} onChange={e => setName(e.target.value)} onBlur={saveName}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      />
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>{savingName ? 'Saving…' : 'Saves when you click away or press Enter.'}</div>

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Icon</label>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '8px 0 10px' }}>We recommend an image of at least 512x512.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <AdjustableImage
          image={iconImage} width={64} height={64} shape="circle"
          fallback={<UserAvatar src={network.iconUrl} name={network.name} size={64} />}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <ImagePickerButton label={network.iconUrl || iconImage ? 'Change Icon' : 'Upload Icon'} shape="circle" frameW={ICON_FRAME} frameH={ICON_FRAME} onApply={handleIconApply} disabled={iconUploading} />
          {(network.iconUrl || iconImage) && (
            <button onClick={handleIconRemove} disabled={iconUploading} style={{ padding: '8px 14px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: iconUploading ? 'default' : 'pointer' }}>
              Remove
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: iconError ? '#e06060' : 'var(--text-muted)', marginBottom: 24 }}>
        {iconUploading ? 'Uploading…' : iconError || 'Drag to reposition and zoom, then it uploads and saves for real.'}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginBottom: 24 }}>
        <label style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Banner</label>
        <div style={{ marginTop: 12, marginBottom: 10 }}>
          <AdjustableImage
            image={bannerImage} width={380} height={120} radius={10}
            fallback={
              network.bannerUrl ? (
                <img
                  src={resolveUrl(network.bannerUrl.startsWith('http') ? network.bannerUrl : `${API_BASE}${network.bannerUrl}`)}
                  alt="" style={{ width: 380, maxWidth: '100%', height: 120, borderRadius: 10, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: 380, maxWidth: '100%', height: 120, borderRadius: 10, background: EMPTY_BANNER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: 600 }}>
                  No banner yet
                </div>
              )
            }
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ImagePickerButton label={network.bannerUrl || bannerImage ? 'Change Banner' : 'Upload Banner'} shape="rect" frameW={BANNER_FRAME_W} frameH={BANNER_FRAME_H} onApply={handleBannerApply} disabled={bannerUploading} />
          {(network.bannerUrl || bannerImage) && (
            <button onClick={handleBannerRemove} disabled={bannerUploading} style={{ padding: '8px 14px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: bannerUploading ? 'default' : 'pointer' }}>
              Remove
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: bannerError ? '#e06060' : 'var(--text-muted)', marginTop: 8 }}>
          {bannerUploading ? 'Uploading…' : bannerError || 'Same flow as the icon — this one actually saves too.'}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginBottom: 24 }}>
        <label style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Traits</label>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>Add up to 5 traits to show off your server's interests and personality.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {traits.map((t, i) => (
            <input
              key={i} className="auth-input" placeholder="😊 Add a trait"
              value={t} onChange={e => setTraits(prev => prev.map((v, j) => j === i ? e.target.value : v))}
            />
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Visual only — no traits field on the backend.</div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginBottom: 24 }}>
        <label style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Description</label>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>How did your server get started? Why should people join?</div>
        <textarea
          className="auth-input" rows={3} placeholder="Tell the world a bit about this server."
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
          value={description} onChange={e => setDescription(e.target.value)} onBlur={saveDescription}
        />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{savingDesc ? 'Saving…' : 'Saves when you click away.'}</div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginBottom: 24 }}>
        <label style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Games</label>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>What games does your server play?</div>
        <input className="auth-input" placeholder="Search for a game…" value={gameQuery} onChange={e => setGameQuery(e.target.value)} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Visual only — there's no game-tagging backend.</div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <SettingRow
          label="Private Profile"
          desc="When enabled, only server members can view profile content. Non-members won't be able to see this content unless they have an invite."
          checked={network.privateProfile}
          onChange={togglePrivate}
        />
      </div>
    </div>
  );
}

// ── Members ─────────────────────────────────────────────────────────────

// Mirrors ChannelService.topRoleColor on the backend exactly: highest-position
// role that actually has a colour set wins, so a colourless role higher up
// doesn't mask a coloured one below it. This is what makes a member's display
// name pick up their role colour — but only here, inside network contexts
// (chat, member list, popovers) — never in DMs or elsewhere in the app.
function topRoleColor(member) {
  const colored = (member.roles || []).filter(r => r.color && r.color.trim());
  if (colored.length === 0) return null;
  return colored.reduce((top, r) => (r.position > top.position ? r : top)).color;
}

function MemberRow({ network, member, roles, onKick, onBan, onToggleRole, onOpenProfile }) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banBusy, setBanBusy] = useState(false);
  const roleColor = topRoleColor(member);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 6 }}>
      <UserAvatar
        src={member.avatar}
        name={member.displayName || member.username}
        size={36}
        onClick={e => onOpenProfile(member, e.currentTarget, roleColor)}
      />
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={e => onOpenProfile(member, e.currentTarget, roleColor)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: roleColor || 'var(--text-primary)' }}>{member.nickname || member.displayName || member.username}</span>
          {member.isOwner && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#f0b232', background: 'rgba(240,178,50,0.15)', borderRadius: 3, padding: '2px 5px' }}>OWNER</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          @{member.username}
          {member.roles && member.roles.length > 0 && (
            <span> · {member.roles.map(r => r.name).join(', ')}</span>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 6 }}>
        <button
          onClick={() => setRoleMenuOpen(v => !v)}
          style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
        >
          Roles
        </button>
        {!member.isOwner && (
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onKick(member); } finally { setBusy(false); } }}
            style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid rgba(224,96,96,0.4)', background: 'transparent', color: '#e06060', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {busy ? 'Kicking…' : 'Kick'}
          </button>
        )}
        {!member.isOwner && onBan && (
          <button
            disabled={banBusy}
            onClick={async () => { setBanBusy(true); try { await onBan(member); } finally { setBanBusy(false); } }}
            style={{ padding: '5px 12px', borderRadius: 4, border: 'none', background: '#e06060', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {banBusy ? 'Banning…' : 'Ban'}
          </button>
        )}
        {roleMenuOpen && (
          <>
            <div onClick={() => setRoleMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 499 }} />
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 500, minWidth: 180,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: 6, maxHeight: 220, overflowY: 'auto',
            }}>
              {roles.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--text-muted)' }}>No roles yet.</div>}
              {roles.map(role => {
                const has = (member.roles || []).some(r => r.id === role.id);
                return (
                  <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={has} onChange={() => onToggleRole(member, role, has)} style={{ accentColor: role.color || 'var(--accent)' }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: role.color || 'var(--text-muted)', flexShrink: 0 }} />
                    {role.name}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MembersTab({ network, onNetworkUpdated }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [kickTarget, setKickTarget] = useState(null);
  const [banTarget, setBanTarget] = useState(null);
  const [banning, setBanning] = useState(false);
  const [banError, setBanError] = useState('');
  const [popover, setPopover] = useState(null); // { userId, anchor, roleColor }

  useEffect(() => {
    let cancelled = false;
    networkApi.getMembers(network.id)
      .then(list => { if (!cancelled) setMembers(list); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load members.'); });
    return () => { cancelled = true; };
  }, [network.id]);

  async function confirmKick() {
    if (!kickTarget) return;
    try {
      await networkApi.kickMember(network.id, kickTarget.userId);
      setMembers(prev => prev.filter(m => m.userId !== kickTarget.userId));
      onNetworkUpdated({ ...network, memberCount: Math.max(0, network.memberCount - 1) });
      setKickTarget(null);
    } catch (e) {
      setError(e.message || 'Failed to kick member.');
    }
  }

  async function confirmBan() {
    if (!banTarget) return;
    setBanning(true); setBanError('');
    try {
      await networkApi.banMember(network.id, banTarget.userId, null);
      setMembers(prev => prev.filter(m => m.userId !== banTarget.userId));
      onNetworkUpdated({ ...network, memberCount: Math.max(0, network.memberCount - 1) });
      setBanTarget(null);
    } catch (e) {
      setBanError(e.message || 'Failed to ban member.');
    } finally {
      setBanning(false);
    }
  }

  async function toggleRole(member, role, has) {
    try {
      if (has) {
        await networkApi.removeRole(network.id, member.userId, role.id);
      } else {
        await networkApi.assignRole(network.id, member.userId, role.id);
      }
      setMembers(prev => prev.map(m => m.userId !== member.userId ? m : {
        ...m,
        roles: has ? m.roles.filter(r => r.id !== role.id) : [...(m.roles || []), role],
      }));
    } catch (e) {
      setError(e.message || 'Failed to update role.');
    }
  }

  const filtered = (members || []).filter(m => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return m.username.toLowerCase().includes(q) || (m.displayName || '').toLowerCase().includes(q) || (m.nickname || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 4px' }}>Members</h2>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{network.memberCount} member{network.memberCount === 1 ? '' : 's'}</div>

      <input className="auth-input" placeholder="Search members" value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: 16 }} />

      {error && <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)', marginBottom: 12 }}>{error}</div>}
      {members === null && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading members…</div>}
      {members !== null && filtered.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No members found.</div>}

      {filtered.map(m => (
        <MemberRow
          key={m.userId}
          network={network}
          member={m}
          roles={network.roles || []}
          onKick={mem => setKickTarget(mem)}
          onBan={mem => setBanTarget(mem)}
          onToggleRole={toggleRole}
          onOpenProfile={(mem, anchor, roleColor) => setPopover({ userId: mem.userId, anchor, roleColor })}
        />
      ))}

      {popover && (
        <NetworkUserPopover
          anchorRef={{ current: popover.anchor }}
          networkId={network.id}
          userId={popover.userId}
          roleColor={popover.roleColor}
          onClose={() => setPopover(null)}
        />
      )}

      {kickTarget && (
        <ConfirmModal
          title="Kick Member"
          message={`Kick ${kickTarget.displayName || kickTarget.username} from ${network.name}? They can rejoin with a new invite.`}
          confirmLabel="Kick"
          onClose={() => setKickTarget(null)}
          onConfirm={confirmKick}
        />
      )}
      {banTarget && (
        <ConfirmModal
          title="Ban Member"
          message={`Ban ${banTarget.displayName || banTarget.username} from ${network.name}? Unlike a kick, they won't be able to rejoin with any invite link until unbanned.`}
          confirmLabel="Ban"
          onClose={() => { setBanTarget(null); setBanError(''); }}
          onConfirm={confirmBan}
          confirming={banning}
          error={banError}
        />
      )}
    </div>
  );
}

// ── Roles ───────────────────────────────────────────────────────────────

// These bit values must mirror net.omnimedia.omni.network.entity.NetworkPermission
// exactly — they're not derived from array order so a reorder here can't
// silently desync from the backend's bitmask. The reference UI (Discord) has
// ~40 granular permission toggles; the backend only has 9 real bits. Each
// group below lists every toggle from the reference for visual completeness,
// but only items with a `bit` actually persist — the rest are local-state
// only for now (no backend field exists yet) and reset on reload. That's a
// deliberate front-end-first tradeoff, not a bug.
const PERMISSION_GROUPS = [
  {
    label: 'General Server Permissions',
    items: [
      { key: 'VIEW_CHANNELS', label: 'View Channels', desc: 'Allows members to view channels by default (excluding private channels).' },
      { key: 'MANAGE_CHANNELS', bit: 1 << 1, label: 'Manage Channels', desc: 'Allows members to create, edit or delete channels.' },
      { key: 'MANAGE_ROLES', bit: 1 << 2, label: 'Manage Roles', desc: 'Allows members to create new roles and edit or delete roles lower than their highest role.' },
      { key: 'CREATE_EXPRESSIONS', label: 'Create Expressions', desc: 'Allows members to add custom emojis, stickers and sounds in this server.' },
      { key: 'MANAGE_EXPRESSIONS', label: 'Manage Expressions', desc: 'Allows members to edit or remove custom emojis, stickers and sounds in this server.' },
      { key: 'VIEW_AUDIT_LOG', label: 'View Audit Log', desc: 'Allows members to view a record of who made which changes in this server.' },
      { key: 'MANAGE_WEBHOOKS', label: 'Manage Webhooks', desc: 'Allows members to create, edit or delete webhooks, which can post messages from other apps or sites into this server.' },
      { key: 'MANAGE_NETWORK', bit: 1 << 0, label: 'Manage Server', desc: "Allow members to change this server's name, view all invites, and manage server settings." },
    ],
  },
  {
    label: 'Membership Permissions',
    items: [
      { key: 'CREATE_INVITE', label: 'Create Invite', desc: 'Allows members to invite new people to this server.' },
      { key: 'CHANGE_NICKNAME', label: 'Change Nickname', desc: 'Allows members to change their own nickname, a custom name just for this server.' },
      { key: 'MANAGE_NICKNAMES', label: 'Manage Nicknames', desc: 'Allows members to change the nicknames of other members.' },
      { key: 'KICK_MEMBERS', bit: 1 << 3, label: 'Kick, Approve and Reject Members', desc: 'Kick will remove other members from this server. Kicked members will be able to re-join if they have another invite.' },
      { key: 'BAN_MEMBERS', bit: 1 << 4, label: 'Ban Members', desc: 'Allows members to permanently ban and delete the message history of other members from this server.' },
      { key: 'TIME_OUT_MEMBERS', label: 'Time out members', desc: 'When you put a user in time-out they will not be able to send messages, react, or speak.' },
    ],
  },
  {
    label: 'Text Channel Permissions',
    items: [
      { key: 'SEND_MESSAGES', label: 'Send Messages and Create Posts', desc: 'Allow members to send messages in text channels and create posts in forum channels.' },
      { key: 'SEND_MESSAGES_THREADS', label: 'Send Messages in Threads and Posts', desc: 'Allow members to send messages in threads and in posts on forum channels.' },
      { key: 'CREATE_PUBLIC_THREADS', label: 'Create Public Threads', desc: 'Allow members to create threads that everyone in a channel can view.' },
      { key: 'CREATE_PRIVATE_THREADS', label: 'Create Private Threads', desc: 'Allow members to create invite-only threads.' },
      { key: 'EMBED_LINKS', label: 'Embed Links', desc: 'Allows links that members share to show embedded content in text channels.' },
      { key: 'ATTACH_FILES', label: 'Attach Files', desc: 'Allows members to upload files or media in text channels.' },
      { key: 'ADD_REACTIONS', label: 'Add Reactions', desc: 'Allows members to add new emoji reactions to a message.' },
      { key: 'USE_EXTERNAL_EMOJIS', label: 'Use External Emojis', desc: "Allows members to use emojis from other servers if they're a Nitro member." },
      { key: 'USE_EXTERNAL_STICKERS', label: 'Use External Stickers', desc: "Allows members to use stickers from other servers if they're a Nitro member." },
      { key: 'MENTION_EVERYONE', label: 'Mention @everyone, @here and All Roles', desc: 'Allows members to use @everyone or @here, and mention all roles.' },
      { key: 'MANAGE_MESSAGES', bit: 1 << 6, label: 'Manage Messages', desc: "Allows members to delete or remove embeds from messages by other members." },
      { key: 'PIN_MESSAGES', label: 'Pin Messages', desc: 'Allows members to pin or unpin any message.' },
      { key: 'BYPASS_SLOWMODE', label: 'Bypass Slowmode', desc: 'Allows members to send messages without being affected by slowmode.' },
      { key: 'MANAGE_THREADS', label: 'Manage Threads and Posts', desc: 'Allows members to rename, delete, close and turn on slow mode for threads and posts.' },
      { key: 'READ_HISTORY', label: 'Read Message History', desc: 'Allows members to read previous messages sent in channels.' },
      { key: 'SEND_TTS', label: 'Send Text-to-speech Messages', desc: 'Allows members to send text-to-speech messages by starting a message with /tts.' },
      { key: 'SEND_VOICE_MESSAGES', label: 'Send Voice Messages', desc: 'Allows members to send voice messages.' },
      { key: 'CREATE_POLLS', label: 'Create Polls', desc: 'Allows members to create polls.' },
    ],
  },
  {
    label: 'Voice Channel Permissions',
    items: [
      { key: 'CONNECT_VOICE', bit: 1 << 7, label: 'Connect', desc: 'Allows members to join voice channels and hear others.' },
      { key: 'SPEAK', label: 'Speak', desc: 'Allows members to talk in voice channels.' },
      { key: 'VIDEO', label: 'Video', desc: 'Allows members to share their video, screen share or stream a game in this server.' },
      { key: 'USE_SOUNDBOARD', label: 'Use Soundboard', desc: 'Allows members to send sounds from server soundboard.' },
      { key: 'USE_EXTERNAL_SOUNDS', label: 'Use External Sounds', desc: "Allows members to use sounds from other servers if they're a Nitro member." },
      { key: 'USE_VOICE_ACTIVITY', label: 'Use Voice Activity', desc: 'Allows members to speak in voice channels by simply talking.' },
      { key: 'PRIORITY_SPEAKER', label: 'Priority Speaker', desc: 'Allows members to be more easily heard in voice channels.' },
      { key: 'MUTE_MEMBERS', bit: 1 << 8, label: 'Mute Members', desc: 'Allows members to mute other members in voice channels for everyone.' },
      { key: 'DEAFEN_MEMBERS', label: 'Deafen Members', desc: "Allows members to deafen other members in voice channels, which means they won't be able to speak or hear others." },
      { key: 'MOVE_MEMBERS', label: 'Move Members', desc: 'Allows members to disconnect or move other members between voice channels.' },
      { key: 'SET_VOICE_STATUS', label: 'Set Voice Channel Status', desc: 'Allows members to create and edit voice channel status.' },
    ],
  },
  {
    label: 'Apps Permissions',
    items: [
      { key: 'USE_APP_COMMANDS', label: 'Use Application Commands', desc: 'Allows members to use commands from applications, including slash commands and context menu commands.' },
      { key: 'USE_ACTIVITIES', label: 'Use Activities', desc: 'Allows members to use Activities.' },
      { key: 'USE_EXTERNAL_APPS', label: 'Use External Apps', desc: 'Allows apps that members have added to their account to post messages. When disabled, the messages will be private.' },
    ],
  },
  {
    label: 'Events Permissions',
    items: [
      { key: 'CREATE_EVENTS', label: 'Create Events', desc: 'Allows members to create events.' },
      { key: 'MANAGE_EVENTS', label: 'Manage Events', desc: 'Allows members to edit and cancel events.' },
    ],
  },
  {
    label: 'Advanced Permissions',
    items: [
      { key: 'ADMINISTRATOR', label: 'Administrator', desc: 'Members with this permission will have every permission and will also bypass all channel specific permissions or restrictions.', dangerous: true },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items);

function maskToKeys(mask) {
  return ALL_PERMISSIONS.filter(p => p.bit && (mask & p.bit) !== 0).map(p => p.key);
}
function keysToMask(keys) {
  const byKey = Object.fromEntries(ALL_PERMISSIONS.filter(p => p.bit).map(p => [p.key, p.bit]));
  return keys.reduce((acc, k) => acc | (byKey[k] || 0), 0);
}

const ROLE_COLOR_SWATCHES = [
  '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63',
  '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#607d8b',
  '#11806a', '#1f8b4c', '#206694', '#71368a', '#ad1457',
  '#c27c0e', '#a84300', '#992d22', '#979c9f', '#546e7a',
];

// ── Roles: shared kebab menu (list rows + editor header) ───────────────────

function RoleKebabMenu({ anchorRef, onClose, onDuplicate, onCopyId, onDelete, canDelete }) {
  const itemStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left' };
  return (
    <AnchoredMenu anchorRef={anchorRef} onClose={onClose} align="right" width={200}>
      <button style={itemStyle} onClick={() => { onDuplicate(); onClose(); }}>Duplicate Role {ICONS.copy}</button>
      <button style={{ ...itemStyle, opacity: 0.45, cursor: 'not-allowed' }} disabled title="Not available yet">View Server as Role {ICONS.chevronRight}</button>
      <button style={itemStyle} onClick={() => { onCopyId(); onClose(); }}>Copy Role ID {ICONS.copy}</button>
      {canDelete && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
          <button style={{ ...itemStyle, color: '#e06060' }} onClick={() => { onDelete(); onClose(); }}>Delete {ICONS.trash}</button>
        </>
      )}
    </AnchoredMenu>
  );
}

// ── Roles: list view row ───────────────────────────────────────────────────

function RoleListRow({ role, memberCount, onEdit, onDuplicate, onCopyId, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const kebabRef = useRef(null);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 8px', borderRadius: 6, background: hovered ? 'var(--bg-hover)' : 'transparent' }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: role.color ? `${role.color}33` : 'var(--bg-input)', border: `2px solid ${role.color || 'var(--text-muted)'}`,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: role.color || 'var(--text-muted)' }} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {role.name}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text-muted)', width: 90 }}>
        <span style={{ color: 'var(--text-muted)' }}>{ICONS.person}</span>
        {memberCount === null ? '…' : memberCount}
      </span>
      <button
        onClick={() => onEdit(role)}
        title="Edit Role"
        style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {ICONS.pencil}
      </button>
      {!role.isDefault && (
        <button
          ref={kebabRef}
          onClick={() => setMenuOpen(true)}
          title="More"
          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {ICONS.kebab}
        </button>
      )}
      {menuOpen && (
        <RoleKebabMenu
          anchorRef={kebabRef}
          onClose={() => setMenuOpen(false)}
          onDuplicate={() => onDuplicate(role)}
          onCopyId={() => onCopyId(role)}
          onDelete={() => onDelete(role)}
          canDelete={!role.isDefault}
        />
      )}
    </div>
  );
}

// ── Roles: editor — Display tab ─────────────────────────────────────────────

function RoleDisplayTab({ name, setName, color, setColor, roleStyle, setRoleStyle, mentionable, setMentionable, hoistDisplay, setHoistDisplay }) {
  const [customPickerOpen, setCustomPickerOpen] = useState(false);

  const styleCards = [
    { key: 'solid', label: 'Solid', locked: false },
    { key: 'gradient', label: 'Gradient', locked: true },
    { key: 'holographic', label: 'Holographic', locked: true },
  ];

  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        Role Name <span style={{ color: '#e06060' }}>*</span>
      </label>
      <input className="auth-input" style={{ marginTop: 8, marginBottom: 24 }} value={name} onChange={e => setName(e.target.value)} />

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 6 }}>
        Role Style
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, background: 'var(--accent)', color: 'var(--accent-text)', borderRadius: 3, padding: '2px 5px' }}>NEW</span>
      </label>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, marginBottom: 24 }}>
        {styleCards.map(card => {
          const selected = roleStyle === card.key;
          const previewBg = card.key === 'solid' ? (color || '#5b6eff')
            : card.key === 'gradient' ? `linear-gradient(135deg, ${color || '#5b6eff'}, #ff8fd4)`
            : 'linear-gradient(135deg, #ff8fd4, #7ac9ff, #c9ff8f, #ff8fd4)';
          return (
            <div
              key={card.key}
              onClick={() => !card.locked && setRoleStyle(card.key)}
              style={{
                flex: 1, borderRadius: 10, border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                background: 'var(--bg-input)', overflow: 'hidden', cursor: card.locked ? 'default' : 'pointer', position: 'relative',
              }}
            >
              <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, background: previewBg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text', color: card.key === 'solid' ? previewBg : undefined,
                }}>
                  Wumpus rocks a...
                </span>
              </div>
              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {card.label}
                {selected && <span style={{ color: 'var(--accent)' }}>{ICONS.check}</span>}
              </div>
              {card.locked && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <span style={{ color: '#fff' }}>{ICONS.lock}</span>
                  <button disabled style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', opacity: 0.85, cursor: 'not-allowed' }}>
                    Unlock with Boosting
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        Role Colour <span style={{ color: '#e06060' }}>*</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8, marginTop: 10, marginBottom: 24, maxWidth: 380, position: 'relative' }}>
        {ROLE_COLOR_SWATCHES.map(hex => (
          <button
            key={hex}
            onClick={() => setColor(hex)}
            title={hex}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: color.toLowerCase() === hex ? '2px solid #fff' : '2px solid transparent',
              background: hex, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: color.toLowerCase() === hex ? '0 0 0 2px var(--accent)' : 'none',
            }}
          >
            {color.toLowerCase() === hex && <span style={{ color: '#fff' }}>{ICONS.check}</span>}
          </button>
        ))}
        <button
          onClick={() => setCustomPickerOpen(v => !v)}
          title="Custom colour"
          style={{
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', border: '2px solid var(--border)',
            background: 'conic-gradient(from 180deg, #ff5c5c, #ffd75c, #5cff8f, #5cd7ff, #8f5cff, #ff5cd7, #ff5c5c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {!ROLE_COLOR_SWATCHES.includes(color.toLowerCase()) && <span style={{ color: '#fff' }}>{ICONS.check}</span>}
        </button>
        {customPickerOpen && (
          <div style={{ position: 'absolute', top: 40, left: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 36, height: 32, border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer', padding: 0 }} />
            <input className="auth-input" style={{ width: 100 }} value={color} onChange={e => setColor(e.target.value)} />
          </div>
        )}
      </div>

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 6 }}>
        Role Icon
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, background: 'var(--bg-input)', color: 'var(--text-muted)', borderRadius: 3, padding: '2px 5px' }}>LVL 2</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 4 }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--bg-input)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        </div>
        <button disabled style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--bg-input)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'not-allowed' }}>
          Choose Image
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Boost-gated — no upload storage wired up for this yet.</div>

      <SettingRow
        label="Display role members separately from online members"
        checked={hoistDisplay}
        onChange={setHoistDisplay}
      />
      <SettingRow
        label="Allow anyone to @mention this role"
        desc="Anyone will be able to mention this role, even if they don't have the Mention permission."
        checked={mentionable}
        onChange={setMentionable}
      />

      <div style={{ marginTop: 20 }}>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>View Server as Role</label>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
          Temporarily see the server the way a member with only this role would see it.
        </p>
        <button disabled style={{ marginTop: 8, padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'not-allowed' }}>
          View Server as Role
        </button>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
        Only role name and colour are saved right now — style, icon, and the two toggles above are visual previews.
      </div>
    </div>
  );
}

// ── Roles: editor — Permissions tab ─────────────────────────────────────────

function RolePermissionsTab({ permKeys, togglePerm, onClear }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const visibleGroups = PERMISSION_GROUPS
    .map(g => ({ ...g, items: q ? g.items.filter(p => p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length > 0);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{ICONS.search}</span>
        <input
          className="auth-input"
          placeholder="Search permissions"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ paddingLeft: 34 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={onClear} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          Clear permissions
        </button>
      </div>

      {visibleGroups.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>No permissions match "{query}".</div>}

      {visibleGroups.map(group => (
        <div key={group.label} style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '18px 0 4px' }}>{group.label}</h3>
          {group.items.map(p => (
            <SettingRow
              key={p.key}
              label={<span style={p.dangerous ? { color: '#e06060' } : undefined}>{p.label}</span>}
              desc={p.dangerous ? <span>{p.desc} <strong style={{ color: '#e06060' }}>This is a dangerous permission to grant.</strong></span> : p.desc}
              checked={permKeys.includes(p.key)}
              onChange={() => togglePerm(p.key)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Roles: editor — Manage Members tab ──────────────────────────────────────

function RoleManageMembersTab({ network, role, members, onAssignRole, onRemoveRole }) {
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const addBtnRef = useRef(null);

  const roleMembers = (members || []).filter(m => (m.roles || []).some(r => r.id === role.id));
  const nonRoleMembers = (members || []).filter(m => !(m.roles || []).some(r => r.id === role.id));

  const q = query.trim().toLowerCase();
  const filtered = q ? roleMembers.filter(m => (m.displayName || m.username).toLowerCase().includes(q) || m.username.toLowerCase().includes(q)) : roleMembers;

  const aq = addQuery.trim().toLowerCase();
  const addFiltered = aq ? nonRoleMembers.filter(m => (m.displayName || m.username).toLowerCase().includes(aq) || m.username.toLowerCase().includes(aq)) : nonRoleMembers;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{ICONS.search}</span>
          <input className="auth-input" placeholder="Search Members" value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <button
          ref={addBtnRef}
          onClick={() => setAddOpen(true)}
          disabled={!members}
          style={{ padding: '0 18px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: 13, cursor: members ? 'pointer' : 'default' }}
        >
          Add Members
        </button>
      </div>

      {members === null && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading members…</div>}

      {members && filtered.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-muted)', padding: '16px 0' }}>
          <span style={{ opacity: 0.6 }}>{ICONS.person}</span>
          No members were found. <a onClick={() => setAddOpen(true)} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Add members to this role.</a>
        </div>
      )}

      {filtered.map(m => (
        <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px' }}>
          <UserAvatar src={m.avatar} name={m.displayName || m.username} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: topRoleColor(m) || 'var(--text-primary)' }}>{m.nickname || m.displayName || m.username}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>@{m.username}</div>
          </div>
          <button
            onClick={() => onRemoveRole(m.userId, role)}
            title="Remove from role"
            style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {ICONS.x}
          </button>
        </div>
      ))}

      {addOpen && (
        <AnchoredMenu anchorRef={addBtnRef} onClose={() => setAddOpen(false)} align="right" width={280}>
          <input
            className="auth-input"
            placeholder="Search members to add"
            autoFocus
            value={addQuery}
            onChange={e => setAddQuery(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          {addFiltered.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--text-muted)' }}>Everyone already has this role.</div>}
          {addFiltered.map(m => (
            <button
              key={m.userId}
              onClick={() => onAssignRole(m.userId, role)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
            >
              <UserAvatar src={m.avatar} name={m.displayName || m.username} size={22} />
              {m.nickname || m.displayName || m.username}
            </button>
          ))}
        </AnchoredMenu>
      )}
    </div>
  );
}

// ── Roles: editor shell (two-column) ────────────────────────────────────────

function RoleEditorShell({ network, roles, role, members, onSave, onDelete, onDuplicate, onCreateNew, onSelectRole, onBack, onAssignRole, onRemoveRole }) {
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color || '#5b6eff');
  const [permKeys, setPermKeys] = useState(maskToKeys(role.permissions));
  const [roleStyle, setRoleStyle] = useState('solid');
  const [mentionable, setMentionable] = useState(false);
  const [hoistDisplay, setHoistDisplay] = useState(false);
  const [innerTab, setInnerTab] = useState('display');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [kebabOpen, setKebabOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const kebabRef = useRef(null);

  // Reset local editor state whenever the selected role changes (switching
  // roles in the left column without leaving the editor).
  useEffect(() => {
    setName(role.name);
    setColor(role.color || '#5b6eff');
    setPermKeys(maskToKeys(role.permissions));
    setInnerTab('display');
    setError('');
  }, [role.id]);

  function togglePerm(key) {
    setPermKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function save() {
    if (!name.trim()) { setError('Role needs a name.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(role, { name: name.trim(), color, permissions: keysToMask(permKeys) });
    } catch (e) {
      setError(e.message || 'Failed to save role.');
    } finally {
      setSaving(false);
    }
  }

  function copyId() {
    navigator.clipboard?.writeText(String(role.id)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const orderedRoles = roles.slice().sort((a, b) => (a.isDefault ? 1 : 0) - (b.isDefault ? 1 : 0) || b.position - a.position);
  const innerTabs = [
    { key: 'display', label: 'Display' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'members', label: `Manage Members (${(members || []).filter(m => (m.roles || []).some(r => r.id === role.id)).length})` },
  ];

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, padding: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="15 18 9 12 15 6" /></svg>
            BACK
          </button>
          <button onClick={onCreateNew} title="Create Role" style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'var(--bg-input)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ICONS.plus}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {orderedRoles.map(r => (
            <button
              key={r.id}
              onClick={() => onSelectRole(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, border: 'none', textAlign: 'left', cursor: 'pointer',
                background: r.id === role.id ? 'var(--bg-hover)' : 'transparent', color: r.id === role.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color || 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: r.id === role.id ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Edit Role – {role.name}
          </h2>
          {!role.isDefault && (
            <button ref={kebabRef} onClick={() => setKebabOpen(true)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {ICONS.kebab}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {innerTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setInnerTab(t.key)}
              style={{
                border: 'none', background: 'none', padding: '10px 2px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                color: innerTab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: innerTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {innerTab === 'display' && (
          <RoleDisplayTab
            name={name} setName={setName}
            color={color} setColor={setColor}
            roleStyle={roleStyle} setRoleStyle={setRoleStyle}
            mentionable={mentionable} setMentionable={setMentionable}
            hoistDisplay={hoistDisplay} setHoistDisplay={setHoistDisplay}
          />
        )}
        {innerTab === 'permissions' && (
          <RolePermissionsTab permKeys={permKeys} togglePerm={togglePerm} onClear={() => setPermKeys([])} />
        )}
        {innerTab === 'members' && (
          <RoleManageMembersTab network={network} role={role} members={members} onAssignRole={onAssignRole} onRemoveRole={onRemoveRole} />
        )}

        {error && <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)', margin: '20px 0' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={save} disabled={saving} style={{ padding: '9px 22px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {kebabOpen && (
        <RoleKebabMenu
          anchorRef={kebabRef}
          onClose={() => setKebabOpen(false)}
          onDuplicate={() => onDuplicate(role)}
          onCopyId={copyId}
          onDelete={() => onDelete(role)}
          canDelete={!role.isDefault}
        />
      )}
      {copied && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)', zIndex: 700 }}>
          Role ID copied
        </div>
      )}
    </div>
  );
}

// ── Roles: top-level tab ────────────────────────────────────────────────────

function RolesTab({ network, onNetworkUpdated }) {
  const [editingRole, setEditingRole] = useState(undefined); // undefined = list view, object = editing/creating
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    networkApi.getMembers(network.id)
      .then(list => { if (!cancelled) setMembers(list); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [network.id]);

  const roles = (network.roles || []).slice().sort((a, b) => (a.isDefault ? 1 : 0) - (b.isDefault ? 1 : 0) || b.position - a.position);
  const defaultRole = roles.find(r => r.isDefault);

  function memberCountFor(role) {
    if (role.isDefault) return network.memberCount;
    if (members === null) return null;
    return members.filter(m => (m.roles || []).some(r => r.id === role.id)).length;
  }

  async function handleSave(role, payload) {
    const isNew = !roles.some(r => r.id === role.id);
    if (isNew) {
      const created = await networkApi.createRole(network.id, payload);
      onNetworkUpdated({ ...network, roles: [...(network.roles || []), created] });
      setEditingRole(created);
    } else {
      const updated = await networkApi.updateRole(network.id, role.id, payload);
      onNetworkUpdated({ ...network, roles: (network.roles || []).map(r => r.id === updated.id ? updated : r) });
      setEditingRole(updated);
    }
  }

  async function confirmDelete() {
    try {
      await networkApi.deleteRole(network.id, deleteTarget.id);
      onNetworkUpdated({ ...network, roles: (network.roles || []).filter(r => r.id !== deleteTarget.id) });
      setDeleteTarget(null);
      if (editingRole && editingRole.id === deleteTarget.id) setEditingRole(undefined);
    } catch (e) {
      setError(e.message || 'Failed to delete role.');
    }
  }

  async function handleCreateNew() {
    try {
      const created = await networkApi.createRole(network.id, { name: 'new role', color: '#99aab5', permissions: 0 });
      onNetworkUpdated({ ...network, roles: [...(network.roles || []), created] });
      setEditingRole(created);
    } catch (e) {
      setError(e.message || 'Failed to create role.');
    }
  }

  async function handleDuplicate(role) {
    try {
      const created = await networkApi.createRole(network.id, { name: `${role.name} (copy)`, color: role.color, permissions: role.permissions });
      onNetworkUpdated({ ...network, roles: [...(network.roles || []), created] });
      setEditingRole(created);
    } catch (e) {
      setError(e.message || 'Failed to duplicate role.');
    }
  }

  function handleCopyId(role) {
    navigator.clipboard?.writeText(String(role.id)).catch(() => {});
    setCopiedId(role.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleAssignRole(userId, role) {
    try {
      await networkApi.assignRole(network.id, userId, role.id);
      setMembers(prev => prev && prev.map(m => m.userId !== userId ? m : { ...m, roles: [...(m.roles || []), role] }));
    } catch (e) {
      setError(e.message || 'Failed to add member to role.');
    }
  }

  async function handleRemoveRole(userId, role) {
    try {
      await networkApi.removeRole(network.id, userId, role.id);
      setMembers(prev => prev && prev.map(m => m.userId !== userId ? m : { ...m, roles: (m.roles || []).filter(r => r.id !== role.id) }));
    } catch (e) {
      setError(e.message || 'Failed to remove member from role.');
    }
  }

  if (editingRole !== undefined) {
    return (
      <RoleEditorShell
        network={network}
        roles={roles}
        role={editingRole}
        members={members}
        onSave={handleSave}
        onDelete={role => setDeleteTarget(role)}
        onDuplicate={handleDuplicate}
        onCreateNew={handleCreateNew}
        onSelectRole={r => setEditingRole(r)}
        onBack={() => setEditingRole(undefined)}
        onAssignRole={handleAssignRole}
        onRemoveRole={handleRemoveRole}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const visibleRoles = q ? roles.filter(r => !r.isDefault && r.name.toLowerCase().includes(q)) : roles.filter(r => !r.isDefault);

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 16px' }}>Roles</h2>

      {defaultRole && (
        <button
          onClick={() => setEditingRole(defaultRole)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', marginBottom: 16,
            borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Default Permissions</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>@everyone — the base permissions every member has.</div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>{ICONS.chevronRight}</span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{ICONS.search}</span>
          <input className="auth-input" placeholder="Search Roles" value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <button
          onClick={handleCreateNew}
          style={{ padding: '0 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Create Role
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 18 }}>
        Members use the colour of the highest role they have on this list. Drag roles to reorder them.{' '}
        <span style={{ color: 'var(--accent)', cursor: 'default' }}>Need help with permissions?</span>
      </p>

      {error && <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)', marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', marginBottom: 6 }}>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Roles — {roles.length}</span>
        <span style={{ width: 90, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Members</span>
        <span style={{ width: 64 }} />
      </div>

      {visibleRoles.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px' }}>No roles match "{query}".</div>}
      {visibleRoles.map(role => (
        <RoleListRow
          key={role.id}
          role={role}
          memberCount={memberCountFor(role)}
          onEdit={r => setEditingRole(r)}
          onDuplicate={handleDuplicate}
          onCopyId={handleCopyId}
          onDelete={r => setDeleteTarget(r)}
        />
      ))}

      {defaultRole && !q && (
        <RoleListRow
          role={defaultRole}
          memberCount={memberCountFor(defaultRole)}
          onEdit={r => setEditingRole(r)}
          onDuplicate={handleDuplicate}
          onCopyId={handleCopyId}
          onDelete={r => setDeleteTarget(r)}
        />
      )}

      {copiedId && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)', zIndex: 700 }}>
          Role ID copied
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Role"
          message={`Delete the "${deleteTarget.name}" role? Members holding it will lose the permissions it grants.`}
          confirmLabel="Delete Role"
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}


// ── Invites ─────────────────────────────────────────────────────────────

function InvitesTab({ network }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/invite/${network.inviteCode}`;

  function copy() {
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>Invites</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        Every server has one standing invite link — there's no per-invite expiry, use-limit, or tracking yet, just this one code.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="auth-input" readOnly value={inviteUrl} style={{ flex: 1 }} />
        <button
          onClick={copy}
          style={{
            padding: '8px 20px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: copied ? 'var(--bg-input)' : 'var(--accent)', color: copied ? 'var(--text-secondary)' : 'var(--accent-text)',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// ── Server Tag ──────────────────────────────────────────────────────────

function ServerTagTab({ network }) {
  const [tagName, setTagName] = useState('');
  const badges = ['🍃', '⚔️', '💜', '🍑', '💧', '💀', '🌙', '⚡', '✨', '🦋'];
  const [badge, setBadge] = useState(0);
  const colors = ['#5b6eff', '#e0483e', '#3ba55d', '#f0912a', '#b25cf0'];
  const [color, setColor] = useState(0);

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>Server Tag</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        Create a tag that your server members can display next to their name! Anyone outside your server can view your Server Profile through the Server Tag.
      </p>

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Choose Name</label>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 10 }}>You may use up to 4 characters, alphabet and numbers.</div>
      <input className="auth-input" maxLength={4} placeholder="TAG" style={{ marginBottom: 24, maxWidth: 160 }} value={tagName} onChange={e => setTagName(e.target.value.toUpperCase())} />

      <label style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>Choose Badge</label>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Changing just the badge won't remove the Server Tag from members.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {badges.map((b, i) => (
          <button
            key={i} onClick={() => setBadge(i)}
            style={{
              width: 40, height: 40, borderRadius: 8, fontSize: 18, cursor: 'pointer',
              background: 'var(--bg-input)', border: badge === i ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {b}
          </button>
        ))}
      </div>

      <label style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 12 }}>Choose Color</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {colors.map((c, i) => (
          <button
            key={i} onClick={() => setColor(i)}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === i ? '2px solid var(--text-primary)' : '2px solid transparent',
            }}
          />
        ))}
      </div>

      {tagName && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-input)', fontSize: 12.5, fontWeight: 700, color: colors[color] }}>
          <span>{badges[badge]}</span>{tagName}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
        Visual only — server tags aren't wired up on the backend yet.
      </div>
    </div>
  );
}

// ── Engagement ──────────────────────────────────────────────────────────

function EngagementTab({ network }) {
  const [welcomeMsg, setWelcomeMsg] = useState(true);
  const [welcomeSticker, setWelcomeSticker] = useState(true);
  const [boostMsg, setBoostMsg] = useState(true);
  const [setupTips, setSetupTips] = useState(true);
  const [activityFeed, setActivityFeed] = useState(true);
  const [notifPref, setNotifPref] = useState('all');
  const [widget, setWidget] = useState(false);
  const channels = network.channels || [];

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 4px' }}>Engagement</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 20 }}>Manage settings that help keep your server active.</p>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>System Messages</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>Configure system event messages sent to your server.</p>
      <SettingRow label="Send a random welcome message when someone joins this server." checked={welcomeMsg} onChange={setWelcomeMsg} />
      <SettingRow label="Prompt members to reply to welcome messages with a sticker." checked={welcomeSticker} onChange={setWelcomeSticker} />
      <SettingRow label="Send a message when someone boosts this server." checked={boostMsg} onChange={setBoostMsg} />
      <SettingRow label="Send helpful tips for server setup." checked={setupTips} onChange={setSetupTips} />

      <div style={{ padding: '14px 0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>System Messages Channel</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>This is the channel we send system event messages to.</div>
        <select className="auth-input" style={{ maxWidth: 260 }} defaultValue={channels[0]?.id || ''}>
          {channels.map(c => <option key={c.id} value={c.id}># {c.name}</option>)}
          {channels.length === 0 && <option>No channels</option>}
        </select>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '20px 0 4px' }}>Activity Feed Settings</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>Shows a feed of activity from games and connected apps in this server.</p>
      <SettingRow label="Display Activity Feed in this server" checked={activityFeed} onChange={setActivityFeed} />

      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '20px 0 4px' }}>Default Notification Settings</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>This determines whether members who haven't explicitly set their notification settings receive a notification for every message sent in this server or not.</p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }}>
        <input type="radio" checked={notifPref === 'all'} onChange={() => setNotifPref('all')} style={{ accentColor: 'var(--accent)' }} /> All Messages
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="radio" checked={notifPref === 'mentions'} onChange={() => setNotifPref('mentions')} style={{ accentColor: 'var(--accent)' }} /> Only @mentions
      </label>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '20px 0 4px' }}>Server Widget</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>Embed an HTML widget on your website to display your online members, voice channels, and invite link.</p>
      <SettingRow label="Enable Server Widget" checked={widget} onChange={setWidget} />

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Visual only — nothing here saves to the backend yet.</div>
    </div>
  );
}

// ── Emoji / Stickers / Soundboard ──────────────────────────────────────

function EmojiTab() {
  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>Emoji</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
        Add up to 50 custom emoji that anyone can use in this server.
      </p>
      <button disabled style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, fontSize: 13.5, opacity: 0.5, cursor: 'not-allowed', marginBottom: 24 }}>
        Upload Emoji
      </button>
      <EmptyState icon="😶" title="NO EMOJI" subtitle="Get the party started by uploading an emoji" />
    </div>
  );
}

function StickersTab() {
  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 16px' }}>Stickers</h2>
      <div style={{ borderRadius: 10, padding: 20, background: 'linear-gradient(120deg, #a557e8, #e05ea0)', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Get Boosted</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', marginBottom: 12, maxWidth: 420 }}>
          Enjoy more stickers and other perks by boosting your server to Level 1. Each level unlocks more sticker slots and new benefits for everyone.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: '#fff', color: '#333', fontWeight: 700, fontSize: 12.5, opacity: 0.6 }}>Boost Server</button>
          <button disabled style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.6)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12.5, opacity: 0.6 }}>Learn More</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Free Slots</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>0 of 5 slots available</div>
        </div>
        <button disabled style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, fontSize: 12.5, opacity: 0.5, cursor: 'not-allowed' }}>Upload Sticker</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 24 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ aspectRatio: '1', borderRadius: 8, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 20 }}>🏷️</div>
        ))}
      </div>

      {[{ lvl: 1, boosts: 2, slots: 10 }, { lvl: 2, boosts: 7, slots: 15 }, { lvl: 3, boosts: 14, slots: 30 }].map(t => (
        <div key={t.lvl} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Level {t.lvl}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>+{t.slots} Sticker Slots</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.boosts} Boosts</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ color: 'var(--text-muted)' }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
        </div>
      ))}
    </div>
  );
}

function SoundboardTab() {
  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>Soundboard</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
        Upload custom sound reactions that anyone in this server can use.
      </p>
      <button disabled style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, fontSize: 13.5, opacity: 0.5, cursor: 'not-allowed', marginBottom: 24 }}>
        Upload Sound
      </button>
      <EmptyState icon="🔇" title="NO SOUNDS" subtitle="Get the party started by uploading a sound" />
    </div>
  );
}

// ── Access ──────────────────────────────────────────────────────────────

function AccessTab({ network, onNetworkUpdated }) {
  const [rules, setRules] = useState(network.rules && network.rules.length > 0 ? network.rules : ['']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const modes = [
    { key: 'INVITE_ONLY', icon: '🔒', label: 'Invite Only', desc: 'People can join your server directly with an invite' },
    { key: 'APPLY_TO_JOIN', icon: '✉️', label: 'Apply to Join', desc: 'People must submit an application and be approved to join' },
    { key: 'DISCOVERABLE', icon: '🌐', label: 'Discoverable', desc: 'Anyone can join your server directly through Server Discovery', disabled: true },
  ];

  async function save(patch) {
    setError('');
    try {
      const updated = await networkApi.updateNetwork(network.id, patch);
      onNetworkUpdated(updated);
    } catch (e) {
      setError(e.message || 'Failed to save.');
    }
  }

  async function saveRules(nextRules) {
    setSaving(true);
    try { await save({ rules: nextRules.filter(r => r.trim()) }); } finally { setSaving(false); }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 16px' }}>Access</h2>

      {error && <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)', marginBottom: 16 }}>{error}</div>}

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>How can people join your server?</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14 }}>Keep your server private, or open it up for more people to join.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 8 }}>
        {modes.map(m => (
          <button
            key={m.key} disabled={m.disabled} onClick={() => save({ accessMode: m.key })}
            style={{
              padding: 16, borderRadius: 8, textAlign: 'center', cursor: m.disabled ? 'not-allowed' : 'pointer',
              background: 'var(--bg-input)', border: network.accessMode === m.key ? '2px solid var(--accent)' : '2px solid transparent',
              opacity: m.disabled ? 0.5 : 1,
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.desc}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
        Invite Only and Apply to Join both save for real. "Discoverable" stays off — there's no public server directory to list it in. Note: picking Apply to Join doesn't yet gate the actual join flow (no application queue exists), it's just recorded.
      </div>

      <SettingRow
        label="Age-Restricted Server"
        desc="Users will need to confirm they are over the legal age to view the content in this server."
        checked={network.ageRestricted}
        onChange={checked => save({ ageRestricted: checked })}
      />
      <SettingRow
        label="Server Rules"
        desc="Members must agree to rules before they can chat or interact in the server."
        checked={network.rulesEnabled}
        onChange={checked => save({ rulesEnabled: checked })}
      >
        {network.rulesEnabled && (
          <div>
            {rules.map((r, i) => (
              <input
                key={i} className="auth-input" placeholder="Enter a rule" style={{ marginBottom: 6 }}
                value={r}
                onChange={e => setRules(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                onBlur={() => saveRules(rules)}
              />
            ))}
            <button
              onClick={() => setRules(prev => [...prev, ''])}
              style={{ width: '100%', padding: '8px 0', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add a rule
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{saving ? 'Saving…' : 'Rules save as you click away from each one. Not yet enforced when chatting — just stored.'}</div>
          </div>
        )}
      </SettingRow>
    </div>
  );
}

// ── Integrations ────────────────────────────────────────────────────────

function IntegrationsTab() {
  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>Integrations</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
        Connect third-party apps and bots to this server.
      </p>
      <EmptyState icon="🔌" title="NO INTEGRATIONS" subtitle="There's no bot/app framework wired up yet." />
    </div>
  );
}

// ── Safety Setup ────────────────────────────────────────────────────────

function SafetySetupTab({ network, onNetworkUpdated }) {
  const [showMembers, setShowMembers] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [error, setError] = useState('');

  async function save(patch) {
    setError('');
    try {
      const updated = await networkApi.updateNetwork(network.id, patch);
      onNetworkUpdated(updated);
    } catch (e) {
      setError(e.message || 'Failed to save.');
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 16px' }}>Safety Setup</h2>

      {error && <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)', marginBottom: 16 }}>{error}</div>}

      <SettingRow
        label="Show Members In Channel List"
        desc="Enabling this will show the members page in the channel list, allowing you to quickly see who's recently joined your server, and find any users flagged for unusual activity."
        checked={showMembers}
        onChange={setShowMembers}
      />

      <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Verification Level</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
          Members of the server must meet certain criteria before they can send messages in text channels or start a direct message conversation.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>None</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unrestricted</div>
          </div>
          <button disabled style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'not-allowed', opacity: 0.6 }}>Change</button>
        </div>
      </div>

      <SettingRow
        label="Require 2FA for moderator actions"
        desc="Moderators must have two-factor authentication enabled to kick or ban members. This is actually enforced — kick/ban will be rejected server-side if it's on and the moderator doesn't have 2FA."
        checked={network.require2faForModeration}
        onChange={checked => save({ require2faForModeration: checked })}
      />
      <SettingRow
        label="Restrict member prune to admins"
        desc="Saved for real, but there's no member-prune feature built yet for it to actually gate — nothing to restrict yet."
        checked={network.restrictPruneToAdmins}
        onChange={checked => save({ restrictPruneToAdmins: checked })}
      />
      <SettingRow
        label="Activity Alerts"
        desc="Receive notifications for DM or join activity that exceeds usual numbers for your server."
        checked={alerts}
        onChange={setAlerts}
      />

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        "Show Members", "Verification Level", and "Activity Alerts" are still visual only — no backing fields for those yet.
      </div>
    </div>
  );
}

// ── Audit Log / Bans / AutoMod ─────────────────────────────────────────

function AuditLogTab() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: 0 }}>Audit Log</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="auth-input" style={{ fontSize: 12.5 }}><option>All Users</option></select>
          <select className="auth-input" style={{ fontSize: 12.5 }}><option>All Actions</option></select>
        </div>
      </div>
      <EmptyState icon="📜" title="NO LOGS YET" subtitle="Once moderators begin moderating, you'll be able to see the log here." />
    </div>
  );
}

function BansTab({ network }) {
  const [query, setQuery] = useState('');
  const [bans, setBans] = useState(null);
  const [error, setError] = useState('');
  const [unbanningId, setUnbanningId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    networkApi.getBans(network.id)
      .then(list => { if (!cancelled) setBans(list); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load bans.'); });
    return () => { cancelled = true; };
  }, [network.id]);

  async function unban(ban) {
    setUnbanningId(ban.userId);
    setError('');
    try {
      await networkApi.unbanMember(network.id, ban.userId);
      setBans(prev => prev.filter(b => b.userId !== ban.userId));
    } catch (e) {
      setError(e.message || 'Failed to unban.');
    } finally {
      setUnbanningId(null);
    }
  }

  const filtered = (bans || []).filter(b => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return b.username.toLowerCase().includes(q) || String(b.userId).includes(q) || (b.displayName || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>Server Ban List</h2>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
        Real ban tracking now — banning removes the member and blocks them rejoining with any invite link. Ban someone from the Members tab; unban from here.
      </p>
      <div style={{ marginBottom: 20 }}>
        <input className="auth-input" placeholder="Search bans by user ID or username" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {error && <div style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)', marginBottom: 16 }}>{error}</div>}

      <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
        {bans === null && <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Loading bans…</div>}
        {bans !== null && filtered.length === 0 && (
          <EmptyState icon="🔨" title="NO BANS" subtitle="Nobody's been banned... but if and when you must, do not hesitate." />
        )}
        {filtered.map(b => (
          <div key={b.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <UserAvatar src={b.avatar} name={b.displayName || b.username} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.displayName || b.username}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                @{b.username}{b.reason ? ` · ${b.reason}` : ''}{b.bannedByUsername ? ` · banned by @${b.bannedByUsername}` : ''}
              </div>
            </div>
            <button
              disabled={unbanningId === b.userId}
              onClick={() => unban(b)}
              style={{ padding: '5px 14px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              {unbanningId === b.userId ? 'Unbanning…' : 'Unban'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutoModTab() {
  const rules = [
    { key: 'mention', icon: '@', title: 'Block Mention Spam', desc: 'Block messages with an excessive number of role and user mentions.' },
    { key: 'spam', icon: '🚫', title: 'Block Suspected Spam Content', desc: 'Monitor messages for potentially spammy content or activity.' },
    { key: 'flagged', icon: '☰', title: 'Block Commonly Flagged Words', desc: 'Flag messages that contain profanity and other commonly flagged words.' },
    { key: 'custom', icon: '📝', title: 'Block Custom Words', desc: 'Create your own filter to block specific language from your server.' },
  ];
  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 8px' }}>AutoMod</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        Give your mods a break while keeping your server safe! Set up filters to moderate content automatically.
      </p>
      {rules.map(r => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{r.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.desc}</div>
          </div>
          <button disabled style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, fontSize: 12.5, opacity: 0.5, cursor: 'not-allowed', flexShrink: 0 }}>
            {r.key === 'custom' ? 'Create' : 'Set Up'}
          </button>
        </div>
      ))}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Visual only — there's no content moderation engine wired up.</div>
    </div>
  );
}

// ── Enable Community ───────────────────────────────────────────────────

function EnableCommunityTab() {
  return (
    <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 20, marginBottom: 8 }}>Are you building a Community?</div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
        Convert to a Community Server to access additional administrative tools that help you moderate and grow your server.
      </p>
      <button disabled style={{ padding: '10px 20px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: 14, opacity: 0.5, cursor: 'not-allowed' }}>
        Enable Community
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>There's no community-server system on the backend yet.</div>
    </div>
  );
}



export default function NetworkSettingsModal({ network: initialNetwork, onClose, onNetworkUpdated }) {
  const [network, setNetwork] = useState(initialNetwork);
  const [tab, setTab] = useState('profile');
  // Local-only (no backend field for either yet) — lifted up here so the
  // editor and the preview card on the right stay in sync with each other.
  const [bannerImage, setBannerImage] = useState(null);
  const [iconImage, setIconImage] = useState(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleNetworkUpdated(updated) {
    setNetwork(updated);
    onNetworkUpdated && onNetworkUpdated(updated);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg-body)', display: 'flex' }}>
      <div style={{ width: 232, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '20px 10px', display: 'flex', flexDirection: 'column' }}>
        {NAV.map((section, i) => (
          <div key={i}>
            <SectionLabel>{section.group(network)}</SectionLabel>
            {section.items.map(item => (
              <NavItem
                key={item.key}
                label={item.label}
                available={item.available}
                external={item.external}
                active={tab === item.key}
                onClick={() => setTab(item.key)}
              />
            ))}
          </div>
        ))}
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <NavItem label="Enable Community" available={true} active={tab === 'community'} onClick={() => setTab('community')} />
        </div>
        <div>
          <NavItem label="Server Template" available={false} onClick={() => {}} />
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ padding: '7px 10px', fontSize: 14.5, fontWeight: 500, color: 'var(--text-muted)', opacity: 0.55 }} title="Use “Leave Server” from the server menu — there's no delete-network endpoint yet.">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#e06060' }}>Delete Server</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, background: 'var(--bg-input)', borderRadius: 3, padding: '2px 5px' }}>SOON</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
        <div style={{ flex: 1, padding: tab === 'roles' ? '40px 24px' : '40px 40px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: tab === 'roles' ? 920 : 560 }}>
            {tab === 'profile' && (
              <ServerProfileTab
                network={network} onNetworkUpdated={handleNetworkUpdated}
                bannerImage={bannerImage} setBannerImage={setBannerImage}
                iconImage={iconImage} setIconImage={setIconImage}
              />
            )}
            {tab === 'tag' && <ServerTagTab network={network} />}
            {tab === 'engagement' && <EngagementTab network={network} />}
            {tab === 'boosts' && <ComingSoon label="Boost Perks" />}
            {tab === 'emoji' && <EmojiTab />}
            {tab === 'stickers' && <StickersTab />}
            {tab === 'soundboard' && <SoundboardTab />}
            {tab === 'members' && <MembersTab network={network} onNetworkUpdated={handleNetworkUpdated} />}
            {tab === 'roles' && <RolesTab network={network} onNetworkUpdated={handleNetworkUpdated} />}
            {tab === 'invites' && <InvitesTab network={network} />}
            {tab === 'access' && <AccessTab network={network} onNetworkUpdated={handleNetworkUpdated} />}
            {tab === 'integrations' && <IntegrationsTab />}
            {tab === 'safety' && <SafetySetupTab network={network} onNetworkUpdated={handleNetworkUpdated} />}
            {tab === 'auditlog' && <AuditLogTab />}
            {tab === 'bans' && <BansTab network={network} />}
            {tab === 'automod' && <AutoModTab />}
            {tab === 'community' && <EnableCommunityTab />}
          </div>
        </div>

        {tab === 'profile' && (
          <div style={{ width: 380, flexShrink: 0, padding: '40px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Preview</div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ height: 110 }}>
                <AdjustableImage
                  image={bannerImage} width={332} height={110} radius={0}
                  fallback={
                    network.bannerUrl ? (
                      <img
                        src={resolveUrl(network.bannerUrl.startsWith('http') ? network.bannerUrl : `${API_BASE}${network.bannerUrl}`)}
                        alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: EMPTY_BANNER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: 600 }}>
                        No banner yet
                      </div>
                    )
                  }
                />
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ marginTop: -36, marginBottom: 10 }}>
                  <div style={{
                    display: 'inline-flex', border: '4px solid var(--bg-elevated)', borderRadius: '50%', lineHeight: 0,
                    background: 'var(--bg-elevated)', boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                  }}>
                    <AdjustableImage
                      image={iconImage} width={64} height={64} shape="circle"
                      fallback={<UserAvatar src={network.iconUrl} name={network.name} size={64} />}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{network.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  {network.memberCount} member{network.memberCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%',
          border: '2px solid var(--text-muted)', background: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Close (Esc)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
}
