import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRequireAccount } from '../hooks/useRequireAccount';
import { api, adminApi, API_BASE, followApi, resolveUrl } from '../services/api';
import CommentsPanel from '../components/CommentsPanel';
import ConfirmModal from '../components/ConfirmModal';

/* ── helpers ── */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 769px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const onChange = e => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtViews(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000) return (n/1000).toFixed(1)+'K';
  return String(n || 0);
}

/* ── Ambient/cinematic glow — matched to what YouTube's page config
   actually reveals (cinematicContainerRenderer), not a guess:
     "presentationStyle": "CINEMATIC_CONTAINER_PRESENTATION_STYLE_DYNAMIC_SINGLE_COLOR"
     "animationConfig": { "minImageUpdateIntervalMs": 5000, "crossfadeDurationMs": 5000, "maxFrameRate": 30 }
     "colorStore": { "sampledColors": [{ "key": "0", "value": <packed ARGB int> }, { "key": "5000", ... }, ...] }
   i.e. it is NOT a second video playing behind the first, and NOT a
   continuous per-frame canvas draw. It's a single dominant color, sampled
   once every 5s, cross-faded into the next sample over the next 5s. We
   don't have a backend that precomputes this, so we sample it live off
   the real <video> element (no duplicate stream needed) on the same
   cadence, and let CSS transition the color change. ── */
const CINEMATIC_SAMPLE_MS    = 5000; // minImageUpdateIntervalMs
const CINEMATIC_CROSSFADE_MS = 5000; // crossfadeDurationMs — for the background-color property itself, once visible
const CINEMATIC_OPACITY      = 0.92; // pushed well past the real decoded alpha (~0.6) — averaged video frames wash out fast, so a stronger glow reads better in practice
const TOGGLE_FADE_MS         = 400;  // separate, snappier fade for the on/off toggle itself — 5s to appear after flipping a switch reads as "broken", not "cinematic"

/* Pushes a sampled {r,g,b} away from its own average brightness, i.e. a
   saturation boost. A plain frame-average tends to land on a muddy grey;
   this makes the glow actually read as "that video's color" instead of
   a dim haze, without changing the sampling method itself. */
function boostColor({ r, g, b }, factor = 2.2) {
  const avg = (r + g + b) / 3;
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return {
    r: clamp(avg + (r - avg) * factor),
    g: clamp(avg + (g - avg) * factor),
    b: clamp(avg + (b - avg) * factor),
  };
}

/* Averages a downscaled frame from a <video> (or <img>) into one {r,g,b}.
   Drawing to a tiny canvas and averaging is the cheap client-side
   equivalent of "sample a dominant color" — same idea as YouTube's
   applyClientImageBlur + blurStrength, just done by us instead of their
   backend. Requires the source to not be CORS-tainted (crossOrigin +
   proper Access-Control-Allow-Origin from wherever the video is served);
   fails silently (keeps last color) otherwise. */
function sampleDominantColor(source) {
  if (!source) return null;
  try {
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0, 12, 12);
    const d = ctx.getImageData(0, 0, 12, 12).data;
    let r = 0, g = 0, b = 0;
    const px = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
    return { r: Math.round(r / px), g: Math.round(g / px), b: Math.round(b / px) };
  } catch {
    return null; // tainted canvas (CORS) or source not ready yet
  }
}

/* Re-samples a video's dominant color on the same 5s cadence YouTube uses,
   while `active`. `getSource` returns the current <video> element to
   sample — a function rather than a plain ref because in some callers
   (the clips carousel) which element is "active" changes as slides swap. */
function useDominantColorGlow(active, getSource, sampleMs = CINEMATIC_SAMPLE_MS) {
  const [color, setColor] = useState(null);
  useEffect(() => {
    if (!active) return;
    function sample() {
      const c = sampleDominantColor(typeof getSource === 'function' ? getSource() : getSource.current);
      if (c) setColor(c);
    }
    sample();
    const id = setInterval(sample, sampleMs);
    return () => clearInterval(id);
  }, [active, getSource, sampleMs]);
  return color;
}

/* Keeps the glow layer mounted for CINEMATIC_CROSSFADE_MS after `active`
   goes false, so its opacity transition can actually play out before it's
   removed from the DOM instead of just popping away. */
function useFadeMount(active, duration = TOGGLE_FADE_MS) {
  const [mounted, setMounted] = useState(active);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let raf, timeout;
    if (active) {
      setMounted(true);
      raf = requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      timeout = setTimeout(() => setMounted(false), duration);
    }
    return () => { if (raf) cancelAnimationFrame(raf); if (timeout) clearTimeout(timeout); };
  }, [active, duration]);
  return { mounted, visible };
}

/* Avatar — only the element itself is clickable, not its surrounding div */
function Avatar({ src, name, size=36, onClick }) {
  const initials = (name||'?').slice(0,2).toUpperCase();
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'block',
    cursor: onClick ? 'pointer' : 'default', objectFit: 'cover' };
  if (src) {
    const url = resolveUrl(src.startsWith('http') ? src : `${API_BASE}${src}`);
    return <img src={url} alt={name} style={style} onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined} />;
  }
  return (
    <div className="omni-page-enter" style={{ ...style, background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: size*0.35, fontWeight: 700, color: '#fff' }}
      onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined}>
      {initials}
    </div>
  );
}

/* SVG icons */
const LikeIcon    = ({active}) => <svg viewBox="0 0 24 24" fill={active?'var(--accent)':'none'} stroke={active?'var(--accent)':'currentColor'} strokeWidth="2" width="15" height="15"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
const DislikeIcon = ({active}) => <svg viewBox="0 0 24 24" fill={active?'#e06060':'none'} stroke={active?'#e06060':'currentColor'} strokeWidth="2" width="15" height="15"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>;
const CommentIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const BackIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>;
const UploadIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const PlayIcon    = () => <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><polygon points="5,3 19,12 5,21"/></svg>;
const DotsIcon    = () => <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>;

/* ── 3-dot menu for owned video ── */
function VideoMenu({ itemId, onDelete, onAdminDelete, onBack, isOwn, isAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const menuItems = [
    {
      label: 'Copy link',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
      onClick: () => { setOpen(false); navigator.clipboard?.writeText(window.location.href); },
    },
    { divider: true },
    ...(isOwn ? [{
      label: 'Delete video',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
      onClick: () => { setOpen(false); onDelete(itemId); },
      danger: true,
    }] : []),
    ...(isAdmin && !isOwn ? [{
      label: 'Delete video (admin)',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
      onClick: () => { setOpen(false); onAdminDelete(itemId); },
      danger: true,
    }] : []),
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px solid var(--border-input)',
          borderRadius: 20, color: 'var(--text-muted)',
          cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontWeight: 600,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <DotsIcon />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          minWidth: 168, zIndex: 100, overflow: 'hidden',
          animation: 'fadeInDown 0.12s ease',
        }}>
          <style>{`@keyframes fadeInDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }`}</style>
          {menuItems.map((item, i) =>
            item.divider ? (
              <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            ) : (
              <button
                key={i}
                onClick={item.onClick}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', background: 'none', border: 'none',
                  color: item.danger ? '#e06060' : 'var(--text-primary)',
                  fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ color: item.danger ? '#e06060' : 'var(--text-muted)', display: 'flex' }}>{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ── VideoFrameThumb — seeks to 1s and shows that frame ── */
function VideoFrameThumb({ src, videoRef }) {
  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      onLoadedMetadata={e => { e.target.currentTime = 1; e.target.style.objectFit = e.target.videoHeight > e.target.videoWidth ? 'contain' : 'cover'; }}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}

/* ── VideoThumbnail — the 16/9 image/frame area, all 4 corners rounded ── */
function VideoThumbnail({ item, imgRef, videoRef }) {
  const thumb = item.thumbnailUrl ? resolveUrl(item.thumbnailUrl.startsWith('http') ? item.thumbnailUrl : `${API_BASE}${item.thumbnailUrl}`) : null;
  const src = resolveUrl(item.videoUrl.startsWith('http') ? item.videoUrl : `${API_BASE}${item.videoUrl}`);
  return (
    <div className="card-thumb-inner" style={{ aspectRatio: '16/9', background: '#000', position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      {thumb
        ? <img ref={imgRef} src={thumb} alt={item.title} crossOrigin="anonymous"
            onLoad={e => { e.target.style.objectFit = e.target.naturalHeight > e.target.naturalWidth ? 'contain' : 'cover'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <VideoFrameThumb src={src} videoRef={videoRef} />}
    </div>
  );
}

/* ── VideoInfoStrip — no background, floats below thumbnail ── */
function VideoInfoStrip({ item, onProfileClick, stripRef }) {
  return (
    <div ref={stripRef} className="video-info-strip" style={{
      display: 'flex', gap: 10, padding: '12px 6px 6px',
      background: 'none'
    }}>
      <div style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <Avatar src={item.authorAvatar} name={item.authorDisplayName || item.authorUsername} size={36}
          onClick={onProfileClick ? () => onProfileClick(item.authorUsername) : undefined} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 4 }}>
          {item.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.authorDisplayName || item.authorUsername}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fmtViews(item.viewCount)} views · {fmtTime(item.createdAt)}</div>
      </div>
    </div>
  );
}

/* ── VideoCard ── */
function VideoCard({ item, onClick, onProfileClick }) {
  const imgRef    = React.useRef(null);
  const videoRef  = React.useRef(null);
  const cardRef   = React.useRef(null);
  const glowRef   = React.useRef(null);

  function sampleColor() {
    const source = (imgRef.current?.complete && imgRef.current?.naturalWidth) ? imgRef.current : videoRef.current;
    if (!source) return null;
    const sample = document.createElement('canvas');
    sample.width = 10; sample.height = 10;
    const sctx = sample.getContext('2d');
    sctx.drawImage(source, 0, 0, 10, 10);
    const d = sctx.getImageData(0, 0, 10, 10).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
    const px = d.length / 4;
    return { R: Math.round(r/px), G: Math.round(g/px), B: Math.round(b/px) };
  }

  function handleEnter() {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;
    card.style.zIndex = 10;
    const col = sampleColor();
    if (!col) return;
    const { R, G, B } = col;
    glow.style.background = `rgba(${R},${G},${B},0.25)`;
    glow.style.boxShadow  = 'none';
    glow.style.opacity    = '1';
  }

  function handleLeave() {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;
    card.style.zIndex  = 1;
    glow.style.opacity = '0';
  }

  return (
    <div ref={cardRef} onClick={() => onClick(item)}
      style={{ cursor: 'pointer', position: 'relative', zIndex: 1 }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}>

      {/* bleed layer — pushed 6px outward in every direction behind the thumbnail */}
      <div ref={glowRef} style={{
        position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
        borderRadius: 14,
        opacity: 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* thumbnail sits on top of glow */}
      <div className="card-thumb-wrap" style={{ position: 'relative', zIndex: 1, borderRadius: 12, overflow: 'hidden' }}>
        <VideoThumbnail item={item} imgRef={imgRef} videoRef={videoRef} />
      </div>

      <VideoInfoStrip item={item} onProfileClick={onProfileClick} stripRef={null} />
    </div>
  );
}

/* ── UploadModal — tabbed: Video / Clip ── */
const TAB_VIDEO = 'video';
const TAB_CLIP  = 'clip';

function UploadModal({ userId, onClose, onUploaded }) {
  const videoFileRef = useRef(), thumbRef = useRef();
  const [tab,          setTab]          = useState(TAB_VIDEO);
  const [file,         setFile]         = useState(null);
  const [thumb,        setThumb]        = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [title,        setTitle]        = useState('');
  const [desc,         setDesc]         = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [durationSecs, setDurationSecs] = useState(0);
  const [durationErr,  setDurationErr]  = useState('');
  const [dragging,     setDragging]     = useState(false);

  const isClip = tab === TAB_CLIP;
  const MAX_CLIP_SECS = 300;

  function switchTab(t) {
    setTab(t); setFile(null); setThumb(null); setThumbPreview(null);
    setTitle(''); setDesc(''); setDurationSecs(0); setDurationErr('');
  }

  function handleVideoFile(f) {
    setFile(f); setDurationErr('');
    const url = URL.createObjectURL(f);
    const vid  = document.createElement('video');
    vid.preload = 'metadata'; vid.muted = true; vid.playsInline = true; vid.src = url;
    vid.addEventListener('loadedmetadata', () => {
      const dur = Math.round(vid.duration);
      setDurationSecs(dur);
      if (isClip && dur > MAX_CLIP_SECS) {
        setDurationErr(`Clip is ${Math.floor(dur/60)}m ${dur%60}s — max is 5 minutes.`);
      }
      vid.currentTime = Math.min(1, vid.duration * 0.1);
    });
    vid.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth; canvas.height = vid.videoHeight;
      canvas.getContext('2d').drawImage(vid, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return;
        const tf = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
        setThumb(prev => prev || tf);
        const r = new FileReader();
        r.onload = ev => setThumbPreview(prev => prev || ev.target.result);
        r.readAsDataURL(tf);
      }, 'image/jpeg', 0.85);
      URL.revokeObjectURL(url);
    });
  }

  async function submit() {
    if (!file || !title.trim() || (isClip && durationSecs > MAX_CLIP_SECS)) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      if (thumb) fd.append('thumbnail', thumb);
      fd.append('authorId', userId);
      fd.append('title', title.trim());
      fd.append('description', desc.trim());
      fd.append('isClip', isClip ? 'true' : 'false');
      fd.append('durationSeconds', String(durationSecs));
      const item = await api.uploadMedia(fd);
      onUploaded(item);
      onClose();
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  const canSubmit = file && title.trim() && !durationErr && !uploading;
  const accentColor = isClip ? '#e94560' : 'var(--accent)';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 500, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: isClip ? 520 : 480, maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-card)', borderRadius: 20, zIndex: 501,
        boxShadow: '0 24px 80px rgba(0,0,0,0.55)', overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Upload</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0', alignItems: 'center' }}>
          {[
            { id: TAB_VIDEO, label: 'Video', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"/></svg> },
            { id: TAB_CLIP,  label: 'Clip',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="8" y="2" width="8" height="20" rx="2"/><polygon points="11 9 14 12 11 15 11 9" fill="currentColor" stroke="none"/></svg> },
          ].map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
              border: tab === t.id ? 'none' : '1px solid var(--border-input)',
              background: tab === t.id ? (t.id === TAB_CLIP ? 'linear-gradient(135deg,#c0392b,#e94560)' : 'var(--accent)') : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--text-muted)',
            }}>
              {t.icon}
              {t.label}
              {t.id === TAB_CLIP && (
                <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.22)', padding: '1px 5px', borderRadius: 4 }}>5 MIN</span>
              )}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
            {isClip ? 'Vertical · short-form' : 'Any format · any length'}
          </span>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 0' }} />

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexDirection: isClip ? 'row' : 'column' }}>

            {/* Drop zone */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div
                onClick={() => videoFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleVideoFile(f); }}
                style={{
                  width: isClip ? 130 : '100%',
                  aspectRatio: isClip ? '9/16' : '16/9',
                  maxHeight: isClip ? 231 : 160,
                  borderRadius: 12,
                  border: `2px dashed ${durationErr ? '#e94560' : dragging ? accentColor : file ? accentColor : 'var(--border-input)'}`,
                  background: dragging ? 'rgba(79,172,254,0.05)' : file ? 'rgba(79,172,254,0.04)' : 'var(--bg-hover)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, cursor: 'pointer', transition: 'all 0.15s',
                  position: 'relative', overflow: 'hidden',
                }}>
                {thumbPreview && (
                  <img src={thumbPreview} alt="preview" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
                )}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {file ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke={durationErr ? '#e94560' : accentColor} strokeWidth="2" width="24" height="24"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: 11, color: durationErr ? '#e94560' : accentColor, fontWeight: 600, textAlign: 'center', padding: '0 8px', maxWidth: 120, wordBreak: 'break-all' }}>{file.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Click to replace</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" width="28" height="28"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '0 8px' }}>
                        {dragging ? 'Drop it!' : 'Drop or click'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>MP4 · MOV</span>
                    </>
                  )}
                </div>
                <input ref={videoFileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); }} />
              </div>
              {isClip && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16, background: 'var(--bg-hover)', border: '1px solid var(--border-input)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#e94560" strokeWidth="2.5" width="11" height="11"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Max 5 min</span>
                </div>
              )}
              {durationErr && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#e94560', textAlign: 'center', maxWidth: 130 }}>{durationErr}</div>
              )}
            </div>

            {/* Fields */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder={isClip ? 'Clip title *' : 'Video title *'}
                style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Description (optional)" rows={isClip ? 4 : 3}
                style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              {!isClip && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div onClick={() => thumbRef.current?.click()}
                    style={{ width: 80, height: 45, borderRadius: 8, border: '2px dashed var(--border-input)', background: 'var(--bg-hover)', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {thumbPreview
                      ? <img src={thumbPreview} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Thumbnail</span>}
                    <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (!f) return; setThumb(f); const r = new FileReader(); r.onload = ev => setThumbPreview(ev.target.result); r.readAsDataURL(f); }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Optional thumbnail. Auto-captured if left blank.</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} disabled={!canSubmit} style={{
              flex: 2, padding: '11px', border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.45,
              background: isClip ? 'linear-gradient(135deg,#c0392b,#e94560)' : 'var(--accent)',
            }}>
              {uploading ? 'Uploading\u2026' : isClip ? '\uD83C\uDFAC Post Clip' : '\uD83D\uDCF9 Post Video'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── ClipsShelf — injected inline between media cards ── */
function fmtDuration(secs) {
  if (!secs) return '';
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ClipThumb({ clip, onClick, isNew }) {
  const [hovered, setHovered] = useState(false);
  const src = clip.thumbnailUrl ? resolveUrl(clip.thumbnailUrl.startsWith('http') ? clip.thumbnailUrl : `${API_BASE}${clip.thumbnailUrl}`) : null;
  return (
    <div onClick={() => onClick(clip)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ flexShrink: 0, width: 232, cursor: 'pointer' }}>
      <div style={{
        position: 'relative', width: 232, height: 412, borderRadius: 14, overflow: 'hidden',
        background: 'var(--bg-hover)',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.2s ease',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.25)',
      }}>
        {src
          ? <img src={src} alt={clip.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-hover))' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)' }} />
        {isNew && (
          <div style={{ position: 'absolute', top: 10, left: 10, background: '#fff', borderRadius: 4, padding: '3px 8px', fontSize: 12, fontWeight: 800, color: '#111' }}>New</div>
        )}
        {hovered && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="var(--text-primary)" width="16" height="16"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 12px 10px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{clip.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>@{clip.authorUsername}</div>
        </div>
        {clip.durationSeconds > 0 && (
          <div style={{ position: 'absolute', bottom: 92, right: 10, background: 'rgba(0,0,0,0.75)', borderRadius: 4, padding: '2px 6px', fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{fmtDuration(clip.durationSeconds)}</div>
        )}
      </div>
    </div>
  );
}

function ClipsShelf({ clips, onClipClick }) {
  if (!clips || clips.length === 0) return null;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days = "New"
  return (
    <div style={{ padding: '14px 0 10px', margin: '4px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', marginBottom: 14, gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#e94560,#c0392b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="white" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Clips</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" width="18" height="18" style={{ cursor: 'pointer' }}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </div>
      {/* Horizontal scroll strip */}
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 24px 4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.clips-strip::-webkit-scrollbar{display:none}`}</style>
        {clips.map(clip => (
          <ClipThumb key={clip.id} clip={clip} onClick={onClipClick}
            isNew={clip.createdAt && new Date(clip.createdAt).getTime() > cutoff} />
        ))}
      </div>
    </div>
  );
}

/* ── ClipPlayer — fullscreen vertical player with scroll/swipe navigation ── */
const CLIP_WINDOW = 1;      // preload this many clips before/after the active one
const CLIP_DRAG_THRESHOLD = 16; // % of screen height needed to commit to next/prev

const moreMenuItemStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 16px', background: 'none', border: 'none',
  color: '#fff', fontSize: 13, cursor: 'pointer', textAlign: 'left',
  transition: 'background 0.12s',
};

function MoreMenuIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 };
  const paths = {
    menu:       <><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></>,
    bookmark:   <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>,
    ambient:    <><rect x="3" y="3" width="18" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    captions:   <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="7" y1="10" x2="10" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/></>,
    fullscreen: <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>,
    block:      <><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></>,
    flag:       <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
    feedback:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}


function ClipPlayer({ clips, startIndex, onClose, onVoteExternal }) {
  const isDesktop = useIsDesktop();
  const requireAccount = useRequireAccount();
  const [index,    setIndex]    = useState(startIndex);
  const [playing,  setPlaying]  = useState(true);
  const [muted,    setMuted]    = useState(false);
  const [overrides,    setOverrides]    = useState({}); // clipId -> latest vote/comment counts
  const [commentsOpen,    setCommentsOpen]    = useState(false);
  const [commentsMounted, setCommentsMounted] = useState(false);
  const [commentsEntered, setCommentsEntered] = useState(false); // flips true one frame after mount so the transition actually plays
  const [shareCopied,  setShareCopied]  = useState(false);
  const [ambientMode,   setAmbientMode]   = useState(false);
  const [moreMenuOpen,  setMoreMenuOpen]  = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const commentsRef = useRef(null);
  const playerRef   = useRef(null);
  const moreMenuRef = useRef(null);
  const touchStartY = useRef(null);
  const videoElsRef = useRef({}); // clipId -> the <video> element for that slide, registered by ClipSlide
  const registerVideo = useCallback((id, el) => {
    if (el) videoElsRef.current[id] = el; else delete videoElsRef.current[id];
  }, []);

  const rawClip = clips[index];
  const clip     = rawClip ? { ...rawClip, ...(overrides[rawClip.id] || {}) } : null;

  // Ambient mode — samples the active slide's own <video> for its dominant
  // color every CINEMATIC_SAMPLE_MS (5s, matching YouTube's real config) and
  // lets CSS crossfade a radial-gradient glow between samples. No second
  // video stream, no per-frame canvas draw — see sampleDominantColor above.
  const { mounted: glowMounted, visible: glowVisible } = useFadeMount(ambientMode && isDesktop);
  const glowColor = useDominantColorGlow(
    ambientMode && isDesktop && !!clip,
    useCallback(() => (clip ? videoElsRef.current[clip.id] : null), [clip])
  );
  const boostedGlow = glowColor ? boostColor(glowColor) : null;

  // Close the "more" menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return;
    function onDown(e) { if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moreMenuOpen]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) playerRef.current?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
    setMoreMenuOpen(false);
  }

  // Live drag position, as a % of screen height. 0 = settled. Kept in a ref (so
  // event handlers always read the latest value without stale closures) mirrored
  // into state (so the drag amount actually re-renders the slides).
  const dragPercentRef = useRef(0);
  const [dragPercent, setDragPercentState] = useState(0);
  const [isDragging,  setIsDragging]       = useState(false);
  function setDragPercent(p) { dragPercentRef.current = p; setDragPercentState(p); }

  // Two-phase mount: render off-screen first, then flip to "entered" on the next
  // animation frame so the browser has a starting style to transition FROM.
  useEffect(() => {
    if (commentsOpen) {
      setCommentsMounted(true);
      const raf = requestAnimationFrame(() => setCommentsEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setCommentsEntered(false);
    if (!commentsMounted) return;
    const t = setTimeout(() => setCommentsMounted(false), 320);
    return () => clearTimeout(t);
  }, [commentsOpen]);

  // Reset per-navigation state when the committed clip changes
  useEffect(() => {
    setPlaying(true); setCommentsOpen(false);
  }, [index]);

  // Like/dislike/comment/share act on whichever clip they're attached to
  // (usually the active one, but works for a peeking neighbor too).
  async function vote(targetClip, type) {
    if (!targetClip) return;
    if (!requireAccount('like or dislike videos')) return;
    try {
      const updated = await api.voteMedia(targetClip.id, type);
      setOverrides(prev => ({ ...prev, [targetClip.id]: updated }));
      onVoteExternal?.(updated);
    } catch {}
  }
  async function handleShare(targetClip) {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: targetClip?.title || 'Clip', url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 1500);
      }
    } catch {}
  }

  const goPrev = useCallback(() => { setIndex(i => Math.max(0, i - 1)); setPlaying(true); }, []);
  const goNext = useCallback(() => { setIndex(i => Math.min(clips.length - 1, i + 1)); setPlaying(true); }, [clips.length]);

  // Mouse wheel — live peek that settles (commits or snaps back) after a short pause
  useEffect(() => {
    function clampDrag(p) {
      if (index === 0 && p > 0) p *= 0.35;
      if (index === clips.length - 1 && p < 0) p *= 0.35;
      return Math.max(-100, Math.min(100, p));
    }
    function settle() {
      setIsDragging(false);
      const p = dragPercentRef.current;
      if (p < -CLIP_DRAG_THRESHOLD) goNext();
      else if (p > CLIP_DRAG_THRESHOLD) goPrev();
      setDragPercent(0);
    }
    let wheelTimer = null;
    function onWheel(e) {
      if (commentsRef.current && commentsRef.current.contains(e.target)) return; // let the comment list scroll normally
      e.preventDefault();
      setIsDragging(true);
      const deltaPercent = (e.deltaY / window.innerHeight) * 100 * 2.2;
      setDragPercent(clampDrag(dragPercentRef.current - deltaPercent));
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(settle, 160);
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => { window.removeEventListener('wheel', onWheel); clearTimeout(wheelTimer); };
  }, [index, clips.length, goNext, goPrev]);

  // Touch swipe — follows the finger 1:1, snaps on release
  useEffect(() => {
    function clampDrag(p) {
      if (index === 0 && p > 0) p *= 0.35;
      if (index === clips.length - 1 && p < 0) p *= 0.35;
      return Math.max(-100, Math.min(100, p));
    }
    function onTouchStart(e) {
      if (e.target.closest && e.target.closest('[data-noswipe]')) { touchStartY.current = null; return; }
      if (commentsRef.current && commentsRef.current.contains(e.target)) { touchStartY.current = null; return; }
      touchStartY.current = e.touches[0].clientY;
      setIsDragging(true);
    }
    function onTouchMove(e) {
      if (touchStartY.current === null) return;
      const dy = e.touches[0].clientY - touchStartY.current; // finger moves down => reveal previous clip
      setDragPercent(clampDrag((dy / window.innerHeight) * 100));
    }
    function onTouchEnd() {
      if (touchStartY.current === null) return;
      touchStartY.current = null;
      setIsDragging(false);
      const p = dragPercentRef.current;
      if (p < -CLIP_DRAG_THRESHOLD) goNext();
      else if (p > CLIP_DRAG_THRESHOLD) goPrev();
      setDragPercent(0);
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [index, clips.length, goNext, goPrev]);

  // Keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowDown')   goNext();
      if (e.key === 'ArrowUp')     goPrev();
      if (e.key === ' ')           { e.preventDefault(); setPlaying(p => !p); }
      if (e.key === 'm')           setMuted(m => !m);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goNext, goPrev]);

  if (!clip) return null;

  const rangeStart = Math.max(0, index - CLIP_WINDOW);
  const rangeEnd   = Math.min(clips.length - 1, index + CLIP_WINDOW);
  const visibleSlides = [];
  for (let i = rangeStart; i <= rangeEnd; i++) visibleSlides.push({ c: clips[i], slideIndex: i });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: isDesktop ? 20 : 0, height: isDesktop ? '92dvh' : '100dvh' }}>

        {/* Video card, wrapped in a glow context matching its exact width/height
            (mirrors the vp-outer/vp-inner split the regular player uses for Ambilight) */}
        <div style={{ position: 'relative', width: isDesktop ? 'min(calc(92dvh * 9 / 16), 460px)' : '100vw', height: '100%', flexShrink: 0 }}>
          {glowMounted && boostedGlow && (
            <div
              style={{
                position: 'absolute', inset: -40, zIndex: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at 50% 50%, rgba(${boostedGlow.r},${boostedGlow.g},${boostedGlow.b},${CINEMATIC_OPACITY}) 0%, rgba(${boostedGlow.r},${boostedGlow.g},${boostedGlow.b},${CINEMATIC_OPACITY}) 40%, rgba(${boostedGlow.r},${boostedGlow.g},${boostedGlow.b},0) 68%)`,
                opacity: glowVisible ? 1 : 0,
                transition: `background ${CINEMATIC_CROSSFADE_MS}ms ease, opacity ${TOGGLE_FADE_MS}ms ease`,
                borderRadius: 32,
              }} />
          )}

        <div ref={playerRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: isDesktop ? 20 : 0,
            overflow: 'hidden',
            boxShadow: isDesktop ? '0 20px 60px rgba(0,0,0,0.6)' : 'none',
            background: '#000',
            zIndex: 1,
          }}>

          {/* Windowed, drag-driven slide carousel — video + info + action buttons all move together */}
          {visibleSlides.map(({ c, slideIndex }) => (
            <ClipSlide
              key={c.id}
              clip={{ ...c, ...(overrides[c.id] || {}) }}
              isActive={slideIndex === index}
              muted={muted}
              playingIntent={playing}
              offset={slideIndex - index}
              dragPercent={dragPercent}
              isDragging={isDragging}
              onTogglePlay={e => { e.stopPropagation(); setPlaying(p => !p); }}
              isDesktop={isDesktop}
              commentsOpen={commentsOpen}
              onVote={vote}
              onToggleComments={() => setCommentsOpen(o => !o)}
              onShare={handleShare}
              shareCopied={shareCopied}
              registerVideo={registerVideo}
            />
          ))}

          {/* Top bar — fixed chrome, doesn't move with the peek */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)', zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: isDesktop ? '14px 14px 0' : '48px 16px 0', gap: 12 }}>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="16" height="16"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              {!isDesktop && <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Clips</span>}
              {/* Mute toggle */}
              <button onClick={e => { e.stopPropagation(); setMuted(m => !m); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
                {muted
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                }
              </button>

              {/* More options */}
              <div ref={moreMenuRef} style={{ position: 'relative' }}>
                <button onClick={e => { e.stopPropagation(); setMoreMenuOpen(o => !o); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                </button>

                {moreMenuOpen && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 6,
                    background: '#181818', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    minWidth: 230, zIndex: 20, overflow: 'hidden', padding: '6px 0',
                  }}>
                    {[
                      { label: 'Description', icon: 'menu', onClick: () => { setDescriptionOpen(o => !o); setMoreMenuOpen(false); } },
                      { label: 'Save to playlist', icon: 'bookmark', onClick: () => setMoreMenuOpen(false) },
                    ].map(item => (
                      <button key={item.label} onClick={item.onClick} style={moreMenuItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <MoreMenuIcon name={item.icon} />
                        <span>{item.label}</span>
                      </button>
                    ))}

                    {isDesktop && (
                      <div onClick={() => setAmbientMode(a => !a)} style={{ ...moreMenuItemStyle, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <MoreMenuIcon name="ambient" />
                        <span style={{ flex: 1 }}>Ambient mode</span>
                        <div style={{
                          width: 34, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
                          background: ambientMode ? '#3ea6ff' : 'rgba(255,255,255,0.25)', transition: 'background 0.15s',
                        }}>
                          <div style={{
                            position: 'absolute', top: 2, left: ambientMode ? 16 : 2, width: 16, height: 16, borderRadius: '50%',
                            background: '#fff', transition: 'left 0.15s',
                          }} />
                        </div>
                      </div>
                    )}

                    <div style={{ ...moreMenuItemStyle, cursor: 'default', color: 'rgba(255,255,255,0.4)' }}>
                      <MoreMenuIcon name="captions" />
                      <span style={{ flex: 1 }}>Captions</span>
                      <span style={{ fontSize: 12 }}>Off</span>
                    </div>

                    <button onClick={toggleFullscreen} style={moreMenuItemStyle}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <MoreMenuIcon name="fullscreen" />
                      <span>Full screen</span>
                    </button>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />

                    {[
                      { label: "Don't recommend this channel", icon: 'block' },
                      { label: 'Report', icon: 'flag' },
                      { label: 'Send feedback', icon: 'feedback' },
                    ].map(item => (
                      <button key={item.label} onClick={() => setMoreMenuOpen(false)} style={moreMenuItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <MoreMenuIcon name={item.icon} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description panel */}
          {descriptionOpen && (
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6,
              maxHeight: '55%', background: '#0f0f0f', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #262626', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Description</span>
                <button onClick={() => setDescriptionOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{clip.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12 }}>
                  {fmtViews(clip.likeCount || 0)} likes · {fmtViews(clip.commentCount || 0)} comments
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {clip.description || 'No description provided.'}
                </div>
              </div>
            </div>
          )}

          {/* Comments — mobile: slide-up sheet over the player */}
          {commentsMounted && !isDesktop && (
            <div ref={commentsRef} onClick={e => e.stopPropagation()} style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6,
              height: '65%', background: '#0f0f0f', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
              transform: commentsEntered ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #262626', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Comments</span>
                <button onClick={() => setCommentsOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <CommentsPanel type="media" targetId={clip.id} inline={true} />
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Desktop: action buttons — same windowed carousel as the video, so they move
            in lockstep (identical transform math) and swap to the neighbor's data
            during the peek instead of staying pinned to the old committed clip. */}
        {isDesktop && (
          <div style={{ position: 'relative', width: 88, height: '100%', flexShrink: 0, overflow: 'hidden' }}>
            {visibleSlides.map(({ c, slideIndex }) => (
              <div key={c.id} style={{
                position: 'absolute', inset: 0, height: '100%',
                transform: `translateY(${(slideIndex - index) * 100 + dragPercent}%)`,
                transition: isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
              }}>
                <ClipActions clip={{ ...c, ...(overrides[c.id] || {}) }} isDesktop={true}
                  commentsOpen={slideIndex === index && commentsOpen}
                  onVote={vote} onToggleComments={() => setCommentsOpen(o => !o)} onShare={handleShare} shareCopied={shareCopied} />
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Desktop: comments panel — fixed drawer, doesn't push the video/buttons */}
      {commentsMounted && isDesktop && (
        <div ref={commentsRef} onClick={e => e.stopPropagation()} style={{
          position: 'fixed', top: '4dvh', right: 24, width: 'min(400px, 32vw)', minWidth: 340, height: '92dvh',
          background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 10,
          transform: commentsEntered ? 'translateX(0)' : 'translateX(40px)',
          opacity: commentsEntered ? 1 : 0,
          pointerEvents: commentsEntered ? 'auto' : 'none',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.28s ease',
        }}>
          <CommentsPanel type="media" targetId={clip.id} inline={true} onClose={() => setCommentsOpen(false)} />
        </div>
      )}
    </div>
  );
}

/* ── ClipActions — like/dislike/comment/share, reused inside each slide and (in desktop
   layout) alongside the video card. Moves together with whatever transform its parent applies. ── */
function ClipActions({ clip, isDesktop, commentsOpen, onVote, onToggleComments, onShare, shareCopied }) {
  const items = [
    {
      id: 'like',
      icon: <svg viewBox="0 0 24 24" fill={clip.userVote === 'LIKE' ? '#fff' : 'none'} stroke="white" strokeWidth="2" width={isDesktop ? 22 : 24} height={isDesktop ? 22 : 24}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
      label: fmtViews(clip.likeCount || 0),
      onClick: () => onVote(clip, 'LIKE'),
      active: clip.userVote === 'LIKE',
    },
    {
      id: 'dislike',
      icon: <svg viewBox="0 0 24 24" fill={clip.userVote === 'DISLIKE' ? '#e06060' : 'none'} stroke={clip.userVote === 'DISLIKE' ? '#e06060' : 'white'} strokeWidth="2" width={isDesktop ? 22 : 24} height={isDesktop ? 22 : 24}><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>,
      label: clip.dislikeCount > 0 ? fmtViews(clip.dislikeCount) : 'Dislike',
      onClick: () => onVote(clip, 'DISLIKE'),
      active: clip.userVote === 'DISLIKE',
      activeColor: '#e06060',
    },
    {
      id: 'comment',
      icon: <svg viewBox="0 0 24 24" fill={commentsOpen ? '#fff' : 'none'} stroke="white" strokeWidth="2" width={isDesktop ? 22 : 24} height={isDesktop ? 22 : 24}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      label: fmtViews(clip.commentCount || 0),
      onClick: onToggleComments,
      active: commentsOpen,
    },
    {
      id: 'share',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width={isDesktop ? 22 : 24} height={isDesktop ? 22 : 24}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
      label: shareCopied ? 'Copied!' : 'Share',
      onClick: () => onShare(clip),
    },
  ];

  if (isDesktop) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '18%', gap: 20, alignItems: 'center', height: '100%', flexShrink: 0 }}>
        {items.map(({ id, icon, label, onClick, active, activeColor }) => (
          <button key={id} onClick={onClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}>
              {icon}
            </div>
            <span style={{ color: active ? (activeColor || '#fff') : 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', right: 12, bottom: 160, zIndex: 4, display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
      {items.map(({ id, icon, label, onClick, active, activeColor }) => (
        <div key={id} onClick={e => { e.stopPropagation(); onClick(); }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <div style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}>{icon}</div>
          <span style={{ color: active ? (activeColor || '#fff') : 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── ClipSlide — one clip's video + bottom info + action buttons. Everything here
   moves as a single unit during the peek/drag, and swaps to the new clip's data
   only once the parent actually commits to a new index. ── */
function ClipSlide({ clip, isActive, muted, playingIntent, offset, dragPercent, isDragging, onTogglePlay, isDesktop, commentsOpen, onVote, onToggleComments, onShare, shareCopied, registerVideo }) {
  const videoRef    = useRef(null);
  const progressRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  // Expose this slide's <video> element to the parent (used for ambient mode's
  // color sampling on whichever clip is currently active)
  useEffect(() => {
    registerVideo?.(clip.id, videoRef.current);
    return () => registerVideo?.(clip.id, null);
  }, [clip.id]);

  // Play the active slide, pause everything else
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && playingIntent) v.play().catch(() => {});
    else v.pause();
  }, [isActive, playingIntent]);

  function onTimeUpdate(e) {
    const v = e.target;
    if (scrubbing) return;
    setElapsed(v.currentTime);
    setDuration(v.duration || 0);
    setProgress(v.duration ? v.currentTime / v.duration : 0);
  }
  function onLoadedMetadata(e) { setDuration(e.target.duration || 0); }

  function scrubAt(clientX) {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * (v.duration || 0);
    setProgress(ratio);
    setElapsed(ratio * (v.duration || 0));
  }
  function onBarMouseDown(e) {
    e.stopPropagation();
    setScrubbing(true);
    scrubAt(e.clientX);
    function onMove(ev) { scrubAt(ev.clientX); }
    function onUp()   { setScrubbing(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  function onBarTouchStart(e) {
    e.stopPropagation();
    setScrubbing(true);
    scrubAt(e.touches[0].clientX);
    function onMove(ev) { scrubAt(ev.touches[0].clientX); }
    function onEnd()   { setScrubbing(false); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); }
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }

  const videoSrc = resolveUrl(clip.videoUrl?.startsWith('http') ? clip.videoUrl : `${API_BASE}${clip.videoUrl}`);
  const fmt = s => { const t = Math.floor(s || 0); return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`; };

  return (
    <div style={{
      position: 'absolute', inset: 0, height: '100%',
      transform: `translateY(${offset * 100 + dragPercent}%)`,
      transition: isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      {/* Video — click to play/pause */}
      <video
        ref={videoRef}
        src={videoSrc}
        loop playsInline
        muted={muted}
        preload="auto"
        crossOrigin="anonymous"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onClick={isActive ? onTogglePlay : undefined}
        style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0, cursor: isActive ? 'pointer' : 'default' }}
      />

      {/* Play/pause overlay icon — flashes on toggle */}
      {isActive && !playingIntent && (
        <div onClick={onTogglePlay} style={{
          position: 'absolute', inset: 0, zIndex: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(255,255,255,0.25)',
          }}>
            <svg viewBox="0 0 24 24" fill="white" width="30" height="30"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      )}

      {/* Action buttons — mobile only here; desktop renders its own column beside the video */}
      {!isDesktop && (
        <ClipActions clip={clip} isDesktop={false} commentsOpen={isActive && commentsOpen}
          onVote={onVote} onToggleComments={onToggleComments} onShare={onShare} shareCopied={shareCopied} />
      )}

      {/* Bottom info + scrub bar — belongs to this clip, moves with it */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4, padding: '80px 16px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.88), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar src={clip.authorAvatar} name={clip.authorDisplayName || clip.authorUsername} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>@{clip.authorUsername}</div>
          </div>
        </div>
        <div style={{ color: '#eee', fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{clip.title}</div>
        {clip.description && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{clip.description}</div>}

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace' }}>{fmt(elapsed)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace' }}>{fmt(duration)}</span>
          </div>
          <div
            ref={progressRef}
            data-noswipe="true"
            onMouseDown={onBarMouseDown}
            onTouchStart={onBarTouchStart}
            style={{ height: 18, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '7px 0' }}
          >
            <div style={{ position: 'relative', width: '100%', height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }}>
              <div style={{ width: `${progress * 100}%`, height: '100%', background: '#fff', borderRadius: 2, transition: scrubbing ? 'none' : 'width 0.1s linear' }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${progress * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                transition: scrubbing ? 'none' : 'left 0.1s linear',
              }} />
            </div>
          </div>
        </div>

        {!isDesktop && isActive && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" width="12" height="12"><polyline points="18 15 12 9 6 15"/></svg>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>Scroll or swipe to navigate</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        )}
      </div>

    </div>
  );
}

/* ── AuthorRow with follow button — pfp click only ── */

/* ── Expandable description — recolors background on hover using video frame color ── */
function ExpandableDescription({ text, videoRef }) {
  const [expanded, setExpanded] = React.useState(false);
  const boxRef = React.useRef(null);

  function sampleColor() {
    const v = videoRef?.current;
    if (!v) return null;
    try {
      const c = document.createElement('canvas');
      c.width = 10; c.height = 10;
      c.getContext('2d').drawImage(v, 0, 0, 10, 10);
      const d = c.getContext('2d').getImageData(0, 0, 10, 10).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
      const px = d.length / 4;
      return { R: Math.round(r/px), G: Math.round(g/px), B: Math.round(b/px) };
    } catch { return null; }
  }

  function handleEnter() {
    const col = sampleColor();
    if (!col || !boxRef.current) return;
    boxRef.current.style.background = `rgba(${col.R},${col.G},${col.B},0.25)`;
  }

  function handleLeave() {
    if (boxRef.current) boxRef.current.style.background = 'var(--bg-hover)';
  }

  return (
    <div style={{ marginTop: 12 }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <div ref={boxRef} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-hover)', borderRadius: 10, padding: '12px 16px', transition: 'background 0.3s ease' }}>
        <span style={{ whiteSpace: 'pre-wrap', display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {text}
        </span>
        {!expanded && (
          <span onClick={() => setExpanded(true)}
            style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, display: 'inline-block', marginTop: 2 }}>
            ... more
          </span>
        )}
      </div>
    </div>
  );
}

function AuthorRow({ item, userId }) {
  const navigate = useNavigate();
  const isOwn = userId === item.authorId;
  const [following,     setFollowing]     = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!userId || isOwn) return;
    followApi.status(item.authorId, userId).then(f => setFollowing(f.following)).catch(() => {});
  }, [item.authorId, userId, isOwn]);

  async function handleFollow(e) {
    e.stopPropagation();
    if (!userId || isOwn) return;
    setFollowLoading(true);
    try { const res = await followApi.toggle(item.authorId); setFollowing(res.following); }
    catch {} finally { setFollowLoading(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '1px solid var(--border)', borderBottom: item.description ? '1px solid var(--border)' : 'none' }}>
      {/* Only the avatar navigates to profile */}
      <Avatar src={item.authorAvatar} name={item.authorDisplayName || item.authorUsername} size={40}
        onClick={() => navigate(`/profile/${item.authorUsername}`)} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.authorDisplayName || item.authorUsername}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{item.authorUsername}</div>
      </div>
      {!isOwn && userId && (
        <button onClick={handleFollow} disabled={followLoading}
          style={{ padding: '7px 20px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: following ? '1px solid var(--border-input)' : 'none',
            background: following ? 'var(--bg-hover)' : 'var(--text-primary)',
            color: following ? 'var(--text-secondary)' : 'var(--bg-primary)', flexShrink: 0, transition: 'all 0.15s' }}>
          {following ? '✓ Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

/* ── Custom Video Player ── */
function VideoPlayer({ src, onPlay: onPlayCb, isFullscreen, onToggleFullscreen, isCinematic, onToggleCinematic, item, onVote, commentsOpen, onToggleComments, externalVideoRef, externalReactive, onReactiveChange, pageAmbient }) {
  const internalRef = useRef(null);
  const videoRef    = externalVideoRef || internalRef;
  const seekRef   = useRef(null);
  const hideTimer = useRef(null);

  const [playing,      setPlaying]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [muted,        setMuted]        = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [viewed,       setViewed]       = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState('main'); // 'main' | 'quality' | 'speed'
  const [quality,      setQuality]      = useState('Auto');
  const [speed,        setSpeed]        = useState(1);
  const [internalReactive, setInternalReactive] = useState(false);
  const reactive    = externalReactive !== undefined ? externalReactive : internalReactive;
  const setReactive = onReactiveChange || setInternalReactive;
  const [captionsOn,   setCaptionsOn]   = useState(false);
  const [hoverPct,      setHoverPct]      = useState(0);
  const [hoverTime,     setHoverTime]     = useState(0);
  const [showPreview,   setShowPreview]   = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const previewVideoRef = useRef(null);
  const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function resetHide() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 2500);
  }

  function togglePlay() {
    const v = videoRef.current; if (!v) return;
    if (v.paused) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {}); // swallow AbortError from interrupted play calls
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
      setShowControls(true);
    }
  }

  function onTimeUpdate() {
    const v = videoRef.current; if (!v) return;
    setCurrentTime(v.currentTime);
    if (!viewed && v.currentTime > 3) { setViewed(true); onPlayCb && onPlayCb(); }
  }

  function seek(e) {
    const v = videoRef.current; if (!v || !duration) return;
    const rect = seekRef.current.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  }

  function onSeekHover(e) {
    if (!duration || !seekRef.current) return;
    const rect = seekRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    setHoverPct(pct * 100);
    setHoverTime(t);
    setShowPreview(true);
    if (previewVideoRef.current && Math.abs(previewVideoRef.current.currentTime - t) > 0.2) {
      previewVideoRef.current.currentTime = t;
    }
  }

  function changeVolume(e) {
    const val = parseFloat(e.target.value);
    setVolume(val); setMuted(val === 0);
    if (videoRef.current) videoRef.current.volume = val;
  }

  function toggleMute() {
    const v = videoRef.current; if (!v) return;
    v.muted = !muted; setMuted(!muted);
  }

  function applySpeed(val) {
    setSpeed(val);
    if (videoRef.current) videoRef.current.playbackRate = val;
  }

  // Keyboard shortcuts — YouTube confirms it has exactly this feature (its
  // page schema whitelists a "hotkeyDialogRenderer" for a "?" help dialog),
  // though the specific key list here is our own standard mapping since the
  // dialog's actual copy isn't present in a homepage config dump. Ignored
  // while typing in an input/textarea/contentEditable elsewhere on the page.
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      const v = videoRef.current;
      switch (e.key) {
        case ' ': case 'k':
          e.preventDefault(); togglePlay(); resetHide(); break;
        case 'ArrowRight':
          if (v) v.currentTime = Math.min(duration, v.currentTime + 5); resetHide(); break;
        case 'ArrowLeft':
          if (v) v.currentTime = Math.max(0, v.currentTime - 5); resetHide(); break;
        case 'l':
          if (v) v.currentTime = Math.min(duration, v.currentTime + 10); resetHide(); break;
        case 'j':
          if (v) v.currentTime = Math.max(0, v.currentTime - 10); resetHide(); break;
        case 'ArrowUp': {
          e.preventDefault();
          const nv = Math.min(1, Math.round((volume + 0.05) * 100) / 100);
          setVolume(nv); setMuted(nv === 0); if (v) v.volume = nv;
          resetHide(); break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const nv = Math.max(0, Math.round((volume - 0.05) * 100) / 100);
          setVolume(nv); setMuted(nv === 0); if (v) v.volume = nv;
          resetHide(); break;
        }
        case 'm':
          toggleMute(); resetHide(); break;
        case 'f':
          onToggleFullscreen && onToggleFullscreen(); break;
        case 'Home':
          if (v) v.currentTime = 0; resetHide(); break;
        case 'End':
          if (v) v.currentTime = duration; resetHide(); break;
        case '<': {
          const i = SPEED_STEPS.indexOf(speed);
          applySpeed(SPEED_STEPS[Math.max(0, i - 1)]); break;
        }
        case '>': {
          const i = SPEED_STEPS.indexOf(speed);
          applySpeed(SPEED_STEPS[Math.min(SPEED_STEPS.length - 1, i + 1)]); break;
        }
        case '?':
          setShowShortcuts(s => !s); break;
        default:
          if (/^[0-9]$/.test(e.key) && duration) {
            if (v) v.currentTime = (parseInt(e.key, 10) / 10) * duration;
            resetHide();
          }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration, volume, speed, muted, playing]);

  const pct = duration ? (currentTime / duration) * 100 : 0;

  const iconBtn = (onClick, children, title, active) => (
    <button title={title} onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ background: 'none', border: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: '4px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, transition: 'color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
      onMouseLeave={e => e.currentTarget.style.color = active ? '#fff' : 'rgba(255,255,255,0.85)'}>
      {children}
    </button>
  );

  // Ambilight / Reactive mode — samples the real player's own <video> for
  // its dominant color every CINEMATIC_SAMPLE_MS (5s, matching YouTube's
  // actual cinematicContainerRenderer config) and CSS-crossfades a radial
  // glow between samples. No second video stream needed at all.
  const glowColor = useDominantColorGlow(reactive, videoRef);
  const boostedGlow = glowColor ? boostColor(glowColor) : null;
  const { mounted: glowMounted, visible: glowVisible } = useFadeMount(reactive);

  return (
    <div className="vp-outer" style={{ 
      position: 'relative', width: '100%', 
      aspectRatio: isFullscreen ? undefined : '16/9',
      borderRadius: isFullscreen ? 0 : 12,
      height: isFullscreen ? '100%' : undefined, overflow: 'visible' }}>

      {/* Ambient glow — anchored to the player itself so it scrolls with the video.
          A dominant color sampled off the real video, cross-faded on YouTube's
          own cadence (5s sample / 5s crossfade), rather than a blurred duplicate
          video stream — see sampleDominantColor / useDominantColorGlow above.
          Rendered as a layered box-shadow sitting flush against the player's
          own rect (rather than a radial-gradient blob inset behind it), so the
          glow hugs all four edges evenly and reads as a halo/border wrapping
          the video, the way YouTube's ambilight actually looks. */}
      {glowMounted && boostedGlow && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none',
            borderRadius: isFullscreen ? 0 : 12,
            boxShadow: [
              `0 0 24px 6px rgba(${boostedGlow.r},${boostedGlow.g},${boostedGlow.b},${CINEMATIC_OPACITY})`,
              `0 0 60px 20px rgba(${boostedGlow.r},${boostedGlow.g},${boostedGlow.b},${CINEMATIC_OPACITY * 0.7})`,
              `0 0 120px 45px rgba(${boostedGlow.r},${boostedGlow.g},${boostedGlow.b},${CINEMATIC_OPACITY * 0.4})`,
              `0 0 200px 80px rgba(${boostedGlow.r},${boostedGlow.g},${boostedGlow.b},${CINEMATIC_OPACITY * 0.2})`,
            ].join(', '),
            opacity: glowVisible ? 1 : 0,
            transition: `box-shadow ${CINEMATIC_CROSSFADE_MS}ms ease, opacity ${TOGGLE_FADE_MS}ms ease`,
          }} />
      )}

    <div className="vp-inner"
      style={{ 
        position: 'relative', 
        width: '100%',
        aspectRatio: isFullscreen ? undefined : '16/9',
        background: '#000', borderRadius: isFullscreen ? 0 : 12,
        overflow: 'hidden', cursor: showControls ? 'default' : 'none',
        height: isFullscreen ? '100%' : undefined,
        zIndex: 1 }}
      onMouseMove={resetHide}
      onMouseLeave={() => { if (playing) setShowControls(false); }}>

      <video ref={videoRef} src={src} playsInline crossOrigin="anonymous"
        disablePictureInPicture controlsList="nodownload noremoteplayback nofullscreen"
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onPlay={() => { setPlaying(true); resetHide(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
        onClick={togglePlay}
      />

      {/* Controls overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', padding: '40px 12px 8px', opacity: showControls ? 1 : 0, transition: 'opacity 0.25s', pointerEvents: showControls ? 'all' : 'none' }}>

        {/* Seek bar */}
        <div ref={seekRef} onClick={seek}
          onMouseMove={onSeekHover}
          style={{ height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2, marginBottom: 8, cursor: 'pointer', position: 'relative' }}
          onMouseEnter={e => { e.currentTarget.style.height = '5px'; }}
          onMouseLeave={e => { e.currentTarget.style.height = '3px'; setShowPreview(false); }}>

          {/* Hover scrub preview — frame thumbnail + timestamp, YouTube-style */}
          {showPreview && duration > 0 && (
            <div
              style={{
                position: 'absolute', bottom: 18,
                left: `clamp(72px, ${hoverPct}%, calc(100% - 72px))`,
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                pointerEvents: 'none', zIndex: 20,
              }}>
              <div style={{ width: 148, height: 84, borderRadius: 6, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
                <video ref={previewVideoRef} src={src} muted playsInline preload="metadata" crossOrigin="anonymous"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>
                {fmt(hoverTime)}
              </div>
            </div>
          )}

          <div style={{ width: `${pct}%`, height: '100%', background: '#f00', borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, borderRadius: '50%', background: '#f00' }} />
          </div>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>

          {/* LEFT: play, volume, time */}
          {iconBtn(togglePlay,
            playing
              ? <svg viewBox="0 0 24 24" fill="#fff" width="20" height="20"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg viewBox="0 0 24 24" fill="#fff" width="20" height="20"><polygon points="5,3 19,12 5,21"/></svg>,
            playing ? 'Pause' : 'Play'
          )}

          {iconBtn(toggleMute,
            muted || volume === 0
              ? <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
            'Mute'
          )}
          <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={changeVolume}
            onClick={e => e.stopPropagation()}
            style={{ width: 64, accentColor: '#fff', cursor: 'pointer' }} />

          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginLeft: 8, whiteSpace: 'nowrap' }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* RIGHT: fullscreen-only like/dislike/comments | normal-only cinematic | always fullscreen btn */}

          {isFullscreen && item && onVote && <>
            {/* Like */}
            {iconBtn(() => onVote('LIKE'),
              <><svg viewBox="0 0 24 24" fill={item.userVote==='LIKE'?'#fff':'none'} stroke="#fff" strokeWidth="2" width="18" height="18"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              {item.likeCount > 0 && <span style={{fontSize:12}}>{item.likeCount}</span>}</>,
              'Like', item.userVote === 'LIKE'
            )}
            {iconBtn(() => onVote('DISLIKE'),
              <><svg viewBox="0 0 24 24" fill={item.userVote==='DISLIKE'?'#e06060':'none'} stroke={item.userVote==='DISLIKE'?'#e06060':'#fff'} strokeWidth="2" width="18" height="18"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
              {item.dislikeCount > 0 && <span style={{fontSize:12,color:item.userVote==='DISLIKE'?'#e06060':'inherit'}}>{item.dislikeCount}</span>}</>,
              'Dislike', item.userVote === 'DISLIKE'
            )}
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />
            {iconBtn(onToggleComments,
              <svg viewBox="0 0 24 24" fill={commentsOpen?'#fff':'none'} stroke="#fff" strokeWidth="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
              commentsOpen ? 'Hide comments' : 'Show comments', commentsOpen
            )}
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />
          </>}

          {/* Ambient/Reactive quick toggle — switch-style icon, always visible */}
          {iconBtn(() => setReactive(r => !r),
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18">
              <rect x="1" y="6" width="22" height="12" rx="6"/>
              <circle cx={reactive ? 17 : 7} cy="12" r="4" fill={reactive ? 'var(--accent, #4facfe)' : '#fff'} stroke="none"/>
            </svg>,
            reactive ? 'Ambient mode: on' : 'Ambient mode: off', reactive
          )}

          {/* Captions toggle */}
          {iconBtn(() => setCaptionsOn(c => !c),
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" stroke="none" fontFamily="Arial, sans-serif">CC</text>
            </svg>,
            captionsOn ? 'Captions: on' : 'Captions: off', captionsOn
          )}

          {/* Cinematic mode — normal only */}
          {!isFullscreen && iconBtn(onToggleCinematic,
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18">
              {isCinematic
                ? <><rect x="3" y="7" width="18" height="10" rx="1"/><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="20" x2="21" y2="20"/></>
                : <><rect x="1" y="6" width="22" height="12" rx="1"/></>}
            </svg>,
            isCinematic ? 'Default view' : 'Cinematic mode', isCinematic
          )}

          {/* Settings button + panel */}
          <div style={{ position: 'relative' }}>
            <button title="Settings" onClick={e => { e.stopPropagation(); setSettingsOpen(o => !o); setSettingsPage('main'); }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18"
                style={{ transform: settingsOpen ? 'rotate(30deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            {settingsOpen && (
              <div onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', bottom: 44, right: 0, background: 'rgba(28,28,28,0.93)', border: 'none', borderRadius: 8, minWidth: 250, padding: '6px 0', zIndex: 500, backdropFilter: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', fontFamily: '"YouTube Sans", Roboto, Arial, sans-serif' }}>

                {settingsPage === 'main' && <>
                  {/* Quality */}
                  <button onClick={() => setSettingsPage('quality')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 0, cursor: 'pointer', fontSize: 13, height: 36 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      Quality
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{quality} ›</span>
                  </button>

                  {/* Playback speed */}
                  <button onClick={() => setSettingsPage('speed')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 0, cursor: 'pointer', fontSize: 13, height: 36 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="16" height="16"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                      Playback speed
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{speed === 1 ? 'Normal' : `${speed}x`} ›</span>
                  </button>

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '4px 0' }} />

                  {/* Reactive mode toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', height: 36 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: '#fff', fontSize: 13 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      Reactive mode
                    </div>
                    <div onClick={() => setReactive(r => !r)}
                      style={{ width: 34, height: 14, borderRadius: 7, background: reactive ? 'rgba(62,166,255,0.5)' : 'rgba(255,255,255,0.3)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: -3, left: reactive ? 18 : 0, width: 20, height: 20, borderRadius: '50%', background: reactive ? '#3ea6ff' : '#eee', boxShadow: '0 1px 3px rgba(0,0,0,0.4)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                </>}

                {settingsPage === 'quality' && <>
                  <button onClick={() => setSettingsPage('main')}
                    style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%', background: 'none', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 0, cursor: 'pointer', fontSize: 13, height: 36, borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: 4, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    ‹ Quality
                  </button>
                  {['Auto', '1080p', '720p', '480p', '360p', '240p'].map(q => (
                    <button key={q} onClick={() => { setQuality(q); setSettingsPage('main'); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 0, cursor: 'pointer', fontSize: 13, height: 36, fontWeight: 400 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ paddingLeft: quality === q ? 0 : 24 }}>{q}</span>
                      {quality === q && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" width="16" height="16" style={{ marginLeft: -20 }}><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>
                  ))}
                </>}

                {settingsPage === 'speed' && <>
                  <button onClick={() => setSettingsPage('main')}
                    style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%', background: 'none', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 0, cursor: 'pointer', fontSize: 13, height: 36, borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: 4, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    ‹ Playback speed
                  </button>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(s => (
                    <button key={s} onClick={() => { applySpeed(s); setSettingsPage('main'); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 0, cursor: 'pointer', fontSize: 13, height: 36, fontWeight: 400 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ paddingLeft: speed === s ? 0 : 24 }}>{s === 1 ? 'Normal' : `${s}x`}</span>
                      {speed === s && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" width="16" height="16" style={{ marginLeft: -20 }}><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>
                  ))}
                </>}
              </div>
            )}
          </div>

          {/* Keyboard shortcuts help */}
          {iconBtn(() => setShowShortcuts(true),
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 2-2 3.5"/><line x1="12" y1="16.5" x2="12" y2="16.51"/></svg>,
            'Keyboard shortcuts (?)'
          )}

          {/* Fullscreen */}
          {iconBtn(onToggleFullscreen,
            isFullscreen
              ? <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>,
            isFullscreen ? 'Exit fullscreen' : 'Fullscreen'
          )}
        </div>
      </div>
    </div>

    {/* Keyboard shortcuts dialog — the feature YouTube's own schema confirms
        exists (hotkeyDialogRenderer / hotkeyDialogSectionRenderer) */}
    {showShortcuts && (
        <div onClick={e => { e.stopPropagation(); setShowShortcuts(false); }}
          style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#181818', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, maxHeight: '85%', overflowY: 'auto', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Keyboard shortcuts</div>
              <button onClick={() => setShowShortcuts(false)}
                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}>✕</button>
            </div>
            {[
              ['Play / pause', 'Space or K'],
              ['Seek back / forward 5s', '← / →'],
              ['Seek back / forward 10s', 'J / L'],
              ['Jump to % of video', '0–9'],
              ['Jump to start / end', 'Home / End'],
              ['Volume up / down', '↑ / ↓'],
              ['Mute', 'M'],
              ['Fullscreen', 'F'],
              ['Slower / faster playback', '< / >'],
              ['This dialog', '?'],
            ].map(([label, key]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13.5 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{label}</span>
                <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: 4, fontSize: 12.5 }}>{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SubscribeButton ── */
function SubscribeButton({ authorId, userId }) {
  const [following,  setFollowing]  = React.useState(false);
  const [loading,    setLoading]    = React.useState(false);

  React.useEffect(() => {
    if (!userId || !authorId || userId === authorId) return;
    followApi.status(authorId, userId).then(f => setFollowing(f.following)).catch(() => {});
  }, [authorId, userId]);

  if (!userId || userId === authorId) return null;

  async function toggle(e) {
    e.stopPropagation();
    setLoading(true);
    try { const r = await followApi.toggle(authorId); setFollowing(r.following); }
    catch {} finally { setLoading(false); }
  }

  return (
    <button onClick={toggle} disabled={loading}
      style={{ padding: '7px 16px', background: following ? 'var(--bg-hover)' : '#fff', color: following ? 'var(--text-secondary)' : '#000', border: following ? '1px solid var(--border-input)' : 'none', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
      {loading ? '...' : following ? '✓ Following' : 'Follow'}
    </button>
  );
}

/* ── VideoActionMenu — "..." with Report only ── */
function VideoActionMenu() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef();
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--bg-hover)', border: 'none', borderRadius: '50%', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>
        ···
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, background: 'var(--bg-menu, var(--bg-card))', border: '1px solid var(--border-input)', borderRadius: 12, padding: 6, zIndex: 300, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          <button onClick={() => setOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', color: '#e06060', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Report
          </button>
        </div>
      )}
    </div>
  );
}

/* ── VideoView — YouTube-style layout ── */
export function VideoView({ item: initialItem, userId, isAdmin, onBack, onVoteExternal, onDelete, onAdminDelete, allItems, onSelectItem, externalReactiveMode, onReactiveModeChange }) {
  const requireAccount = useRequireAccount();
  const navigate = useNavigate();
  const [item,         setItem]         = useState(initialItem);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [cinematic,    setCinematic]    = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [internalReactiveMode, setInternalReactiveMode] = useState(false);
  const reactive    = externalReactiveMode !== undefined ? externalReactiveMode : internalReactiveMode;
  const setReactive = onReactiveModeChange || setInternalReactiveMode;

  const src = resolveUrl(item.videoUrl.startsWith('http') ? item.videoUrl : `${API_BASE}${item.videoUrl}`);

  async function vote(type) {
    if (!requireAccount('like or dislike videos')) return;
    try { const u = await api.voteMedia(item.id, type); setItem(u); onVoteExternal(u); } catch {}
  }

  const isOwn  = userId === item.authorId;
  const others = (allItems || []).filter(v => v.id !== item.id);

  const sharedVideoRef  = useRef(null);

  // Fixed glow strip — pinned to the viewport (like the fixed TopBar itself)
  // so it can show through the transparent topbar. Same dominant-color
  // sampling as the player-anchored glow in VideoPlayer, just applied to a
  // fixed-position element instead of one that scrolls with the page.
  const topGlowColor = useDominantColorGlow(reactive, sharedVideoRef);
  const boostedTopGlow = topGlowColor ? boostColor(topGlowColor) : null;
  const { mounted: topGlowMounted, visible: topGlowVisible } = useFadeMount(reactive);

  const playerProps = {
    src,
    onPlay: () => api.viewMedia(item.id).catch(() => {}),
    item,
    onVote: vote,
    commentsOpen,
    onToggleComments: () => setCommentsOpen(o => !o),
    isCinematic: cinematic,
    onToggleCinematic: () => setCinematic(o => !o),
    externalVideoRef: sharedVideoRef,
    externalReactive: reactive,
    onReactiveChange: setReactive,
  };

  /* ── FULLSCREEN mode ── */
  if (fullscreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex' }}>
        {/* Video + controls (like/dislike/comments all inside the player bar) */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Fading top bar with title */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 18px', background: 'linear-gradient(rgba(0,0,0,0.75), transparent)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'none' }}>
            <button onClick={() => setFullscreen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', pointerEvents: 'all' }}>
              <BackIcon />
            </button>
            <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{item.title}</span>
          </div>
          <VideoPlayer {...playerProps} isFullscreen={true} onToggleFullscreen={() => setFullscreen(false)} />
        </div>

        {/* Sliding comments panel */}
        {commentsOpen && (
          <div style={{ width: 400, background: '#0f0f0f', borderLeft: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <CommentsPanel type="media" targetId={item.id} inline={true} />
          </div>
        )}
      </div>
    );
  }

  /* ── NORMAL mode ── */
  return (
    <div style={{ position: 'relative', display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Fixed glow strip — pinned to the viewport so it shows through the
          fixed, transparent TopBar. Sits below the topbar's own z-index. */}
      {topGlowMounted && boostedTopGlow && (
        <div
          style={{
            position: 'fixed', top: -60, left: 0, right: 0, height: 260, zIndex: 150, pointerEvents: 'none',
            background: `radial-gradient(ellipse 70% 100% at 50% 0%, rgba(${boostedTopGlow.r},${boostedTopGlow.g},${boostedTopGlow.b},${CINEMATIC_OPACITY}) 0%, rgba(${boostedTopGlow.r},${boostedTopGlow.g},${boostedTopGlow.b},${CINEMATIC_OPACITY}) 35%, rgba(${boostedTopGlow.r},${boostedTopGlow.g},${boostedTopGlow.b},0) 80%)`,
            opacity: topGlowVisible ? 1 : 0,
            transition: `background ${CINEMATIC_CROSSFADE_MS}ms ease, opacity ${TOGGLE_FADE_MS}ms ease`,
          }} />
      )}
      <style>{`
        /* ── Video Player Page — Mobile YouTube layout ── */
        @media (max-width: 768px) {
          .videoview-root {
            flex-direction: column !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          .videoview-center {
            padding: 0 !important;
            overflow-y: visible !important;
          }
          /* Make the player wrap bleed to edges */
          .videoview-player-wrap {
            margin-left: 0 !important;
            margin-right: 0 !important;
            width: 100% !important;
          }
          /* Kill all border-radius on the player itself */
          .vp-outer,
          .vp-inner,
          .vp-outer > div,
          .vp-inner > div {
            border-radius: 0 !important;
          }
          .videoview-back-bar {
            padding: 10px 14px 6px !important;
            margin-bottom: 0 !important;
          }
          .videoview-title {
            font-size: 15px !important;
            padding: 10px 14px 6px !important;
            margin: 0 !important;
          }
          .videoview-meta-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            padding: 0 14px 10px !important;
            gap: 12px !important;
          }
          .videoview-author-block {
            width: 100% !important;
          }
          .videoview-actions-row {
            width: 100% !important;
            overflow-x: auto !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            padding-bottom: 2px !important;
            justify-content: flex-start !important;
          }
          .videoview-actions-row::-webkit-scrollbar { display: none !important; }
          .videoview-action-btn-text { display: none !important; }
          .videoview-action-btn {
            padding: 7px 10px !important;
            flex-shrink: 0 !important;
          }
          .videoview-action-btn-icon-only {
            padding: 7px 10px !important;
            flex-shrink: 0 !important;
          }
          .videoview-desc {
            padding: 0 14px !important;
          }
          .videoview-comments {
            padding: 0 14px !important;
          }
          .videoview-sidebar {
            width: 100% !important;
            border-left: none !important;
            border-top: 8px solid var(--bg-hover) !important;
            flex-shrink: 0 !important;
            overflow-y: visible !important;
            padding: 12px 14px !important;
          }
          .videoview-sidebar-title {
            display: block !important;
          }
          .sidebar-video-card {
            padding: 6px 0 !important;
          }
          .sidebar-video-thumb {
            width: 120px !important;
            height: 68px !important;
          }
        }
        @media (min-width: 769px) {
          .videoview-sidebar-title { display: none; }
          .sidebar-card-mobile { display: none !important; }
          .sidebar-row-desktop { display: block; }
        }
        @media (max-width: 768px) {
          .sidebar-row-desktop { display: none !important; }
          .sidebar-card-mobile { display: block; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
          .sidebar-card-mobile:last-child { border-bottom: none; }
          /* Full bleed — negative margin cancels the sidebar's 14px padding */
          .sidebar-card-mobile > div {
            margin-left: -14px;
            margin-right: -14px;
          }
          /* Bottom padding on info strip inside sidebar cards */
          .sidebar-card-mobile .video-info-strip { padding-bottom: 14px !important; }
        }
      `}</style>

      <div className="videoview-root" style={{ position: 'relative', zIndex: 1, display: 'flex', flex: 1, overflow: 'hidden', background: reactive ? 'transparent' : 'var(--bg-primary)' }}>

        {/* CENTER column */}
        <div className="videoview-center" style={{ flex: 1, overflowY: 'auto', minWidth: 0, padding: '10px 24px' }}>

          {/* back + menu */}
          <div className="videoview-back-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}>
              <BackIcon /> Back
            </button>
            {(isOwn || isAdmin) && (
              <VideoMenu
                itemId={item.id}
                onDelete={onDelete}
                onAdminDelete={onAdminDelete}
                onBack={onBack}
                isOwn={isOwn}
                isAdmin={isAdmin}
              />
            )}
          </div>

          {/* Player */}
          <div className="videoview-player-wrap">
            <VideoPlayer {...playerProps} isFullscreen={false} onToggleFullscreen={() => setFullscreen(true)} />
          </div>

          {/* title */}
          <h1 className="videoview-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, margin: '14px 0 10px' }}>{item.title}</h1>

          {/* Author row + action buttons */}
          <div className="videoview-meta-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            {/* Left: avatar + name + subscribe */}
            <div className="videoview-author-block" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar src={item.authorAvatar} name={item.authorDisplayName || item.authorUsername} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.authorDisplayName || item.authorUsername}</div>
              </div>
              <SubscribeButton authorId={item.authorId} userId={userId} />
            </div>

            {/* Action buttons */}
            <div className="videoview-actions-row" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Like/Dislike grouped */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-hover)', borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
                <button onClick={() => vote('LIKE')} className="videoview-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'none', border: 'none', borderRight: '1px solid var(--border-input)', color: item.userVote==='LIKE' ? 'var(--accent)' : 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <svg viewBox="0 0 24 24" fill={item.userVote==='LIKE'?'currentColor':'none'} stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  {item.likeCount > 0 ? fmtViews(item.likeCount) : <span className="videoview-action-btn-text">Like</span>}
                </button>
                <button onClick={() => vote('DISLIKE')} className="videoview-action-btn" style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', background: 'none', border: 'none', color: item.userVote==='DISLIKE' ? '#e06060' : 'var(--text-primary)', cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" fill={item.userVote==='DISLIKE'?'currentColor':'none'} stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                </button>
              </div>

              {/* Share */}
              <button className="videoview-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg-hover)', border: 'none', borderRadius: 20, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span className="videoview-action-btn-text">Share</span>
              </button>

              {/* Save */}
              <button className="videoview-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg-hover)', border: 'none', borderRadius: 20, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span className="videoview-action-btn-text">Save</span>
              </button>

              {/* Download */}
              <button className="videoview-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg-hover)', border: 'none', borderRadius: 20, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span className="videoview-action-btn-text">Download</span>
              </button>

              {/* ... report only */}
              <VideoActionMenu />
            </div>
          </div>

          <div className="videoview-desc">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: item.description ? 6 : 0 }}>
              {fmtViews(item.viewCount)} views · {fmtTime(item.createdAt)}
            </div>
            {item.description && <ExpandableDescription text={item.description} videoRef={sharedVideoRef} />}
          </div>

          {/* Comments always shown below */}
          <div className="videoview-comments" style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <CommentsPanel type="media" targetId={item.id} inline={true} />
          </div>
        </div>

        {/* RIGHT SIDEBAR: other videos — hidden in cinematic mode */}
        {!cinematic && (
          <div className="videoview-sidebar" style={{ width: 400, flexShrink: 0, overflowY: 'auto', borderLeft: reactive ? 'none' : '1px solid var(--border)', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 6, background: reactive ? 'transparent' : 'var(--bg-primary)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
            <div className="videoview-sidebar-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Up Next</div>
            {others.map(v => (
              <React.Fragment key={v.id}>
                {/* Desktop: compact row. Mobile: full VideoCard via CSS show/hide */}
                <div className="sidebar-row-desktop">
                  <SidebarVideoCard item={v} onSelect={onSelectItem} />
                </div>
                <div className="sidebar-card-mobile">
                  <VideoCard item={v} onClick={onSelectItem} onProfileClick={username => navigate(`/profile/${username}`)} />
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar video row ── */
function SidebarVideoCard({ item, onSelect }) {
  const thumb = item.thumbnailUrl
    ? resolveUrl(item.thumbnailUrl.startsWith('http') ? item.thumbnailUrl : `${API_BASE}${item.thumbnailUrl}`)
    : null;
  return (
    <div className="sidebar-video-card" onClick={() => onSelect && onSelect(item)}
      style={{ display: 'flex', gap: 8, cursor: 'pointer', borderRadius: 8, padding: '4px', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {/* thumbnail */}
      <div className="sidebar-video-thumb" style={{ width: 200, height: 113, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#111' }}>
        {thumb
          ? <img src={thumb} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <video src={resolveUrl(item.videoUrl.startsWith('http') ? item.videoUrl : `${API_BASE}${item.videoUrl}`)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />}
      </div>
      {/* info */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 4 }}>
          {item.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.authorDisplayName || item.authorUsername}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtViews(item.viewCount)} views · {fmtTime(item.createdAt)}</div>
      </div>
    </div>
  );
}

/* ── MAIN MEDIA PAGE ── */
export default function Media() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(0);
  const [hasMore,   setHasMore]   = useState(true);
  const [clips,         setClips]         = useState([]);
  const [clipPlayer,    setClipPlayer]    = useState(null); // { clips, startIndex }
  const [showUpload,    setShowUpload]    = useState(false);
  const [feedWithClips, setFeedWithClips] = useState([]);

  function watchVideo(item) {
    navigate(`/media/watch/${item.id}`, { state: { item, allItems: items } });
  }

  const loadMedia = useCallback(async (pg = 0) => {
    try {
      setLoading(true);
      const data = await api.getMedia(pg, user?.id);
      setItems(prev => pg === 0 ? data : [...prev, ...data]);
      setHasMore(data.length === 20);
      setPage(pg);
    } catch {} finally { setLoading(false); }
  }, [user?.id]);

  // Load clips once on mount
  useEffect(() => {
    api.getClips(user?.id).then(data => setClips(data || [])).catch(() => {});
  }, [user?.id]);

  // Build feed with clips shelf injected between two full rows of the grid
  useEffect(() => {
    if (items.length === 0) { setFeedWithClips([]); return; }
    if (clips.length === 0) { setFeedWithClips([{ type: 'media-grid', data: items }]); return; }
    const COLS = 4; // matches the desktop .media-grid column count
    const totalRows = Math.ceil(items.length / COLS);
    // pick a row boundary to inject after (never before row 1, never after the very last row)
    const rowCut = totalRows <= 1 ? 1 : Math.floor(Math.random() * Math.min(totalRows - 1, 3)) + 1;
    const splitIndex = rowCut * COLS;
    const before = items.slice(0, splitIndex);
    const after  = items.slice(splitIndex);
    const feed = [
      ...(before.length ? [{ type: 'media-grid', data: before }] : []),
      { type: 'clips-shelf' },
      ...(after.length ? [{ type: 'media-grid', data: after }] : []),
    ];
    setFeedWithClips(feed);
  }, [items, clips.length]);

  useEffect(() => { loadMedia(0); }, [loadMedia]);

  function handleVoteExternal(updated) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    setClips(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  // pending delete confirmation — { mediaId, admin } or null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  function handleDelete(mediaId) {
    setDeleteError('');
    setDeleteTarget({ mediaId, admin: false });
  }

  function handleAdminDelete(mediaId) {
    setDeleteError('');
    setDeleteTarget({ mediaId, admin: true });
  }

  async function confirmDeleteMedia() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      if (deleteTarget.admin) await adminApi.deleteMedia(deleteTarget.mediaId);
      else await api.deleteMedia(deleteTarget.mediaId);
      setItems(prev => prev.filter(i => i.id !== deleteTarget.mediaId));
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete video.');
    } finally {
      setDeleting(false);
    }
  }

  const deleteModal = deleteTarget && (
    <ConfirmModal
      title={deleteTarget.admin ? 'Delete video as admin?' : 'Delete this video?'}
      message={deleteTarget.admin
        ? "This bypasses ownership and can't be undone."
        : "This permanently deletes the video and can't be undone."}
      confirmLabel="Delete"
      onClose={() => setDeleteTarget(null)}
      onConfirm={confirmDeleteMedia}
      confirming={deleting}
      error={deleteError}
    />
  );

  return (
    <div className="media-page-root" style={{ overflowY: 'auto', height: '100%', padding: '20px 24px' }}>
      <style>{`
        .media-grid {
          grid-template-columns: repeat(4, 1fr);
          padding: 0 8px;
        }
        @media (max-width: 1400px) {
          .media-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 980px) {
          .media-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .media-grid { grid-template-columns: 1fr; gap: 20px !important; padding: 0 14px !important; }
          .media-page-root { padding: 0 !important; }
          .media-page-header { padding: 12px 14px 12px !important; margin-bottom: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="media-page-header" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Media</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Videos from the community</div>
        </div>
        {user && (
          <button onClick={() => setShowUpload(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--accent)', border: 'none', color: 'var(--accent-text)',
            padding: '8px 18px', borderRadius: 20, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', flexShrink: 0,
          }}>
            <UploadIcon /> Upload
          </button>
        )}
      </div>

      {loading && page === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="52" height="52" style={{display:"block",margin:"0 auto 16px",color:"var(--text-muted)"}}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No videos yet</div>
          {user && <button onClick={() => setShowUpload(true)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', padding: '10px 28px', borderRadius: 20, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Upload Video</button>}
        </div>
      ) : (
        <>
          {/* Feed with injected clips shelf, rendered as alternating grid chunks */}
          {feedWithClips.map((row, i) =>
            row.type === 'clips-shelf' ? (
              <ClipsShelf
                key="clips-shelf"
                clips={clips}
                onClipClick={clip => {
                  const idx = clips.findIndex(c => c.id === clip.id);
                  setClipPlayer({ clips, startIndex: idx >= 0 ? idx : 0 });
                }}
              />
            ) : (
              <div key={`grid-${i}`} className="media-grid" style={{ display: 'grid', gap: 18, overflow: 'visible' }}>
                {row.data.map(item => (
                  <VideoCard key={item.id} item={item}
                    onClick={watchVideo}
                    onProfileClick={username => navigate(`/profile/${username}`)}
                  />
                ))}
              </div>
            )
          )}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button onClick={() => loadMedia(page + 1)} disabled={loading}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '10px 32px', borderRadius: 20, cursor: 'pointer', fontSize: 14 }}>
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {deleteModal}

      {/* Upload modal */}
      {showUpload && user && (
        <UploadModal
          userId={user.id}
          onClose={() => setShowUpload(false)}
          onUploaded={item => {
            if (item.isClip) setClips(prev => [item, ...prev]);
            else setItems(prev => [item, ...prev]);
          }}
        />
      )}

      {/* Fullscreen clip player */}
      {clipPlayer && (
        <ClipPlayer
          clips={clipPlayer.clips}
          startIndex={clipPlayer.startIndex}
          onClose={() => setClipPlayer(null)}
          onVoteExternal={handleVoteExternal}
        />
      )}
    </div>
  );
}