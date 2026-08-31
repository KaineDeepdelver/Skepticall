import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE, groupApi, resolveUrl } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import MyProfileDrawer from '../components/MyProfileDrawer';
import UserAvatar from '../components/UserAvatar';
import GroupInfoPanel from '../components/GroupInfoPanel';
import LinkPreview, { extractFirstUrl } from '../components/LinkPreview';
import { useFriends } from '../context/FriendContext';
import { useCall } from '../context/CallContext';
import toast from 'react-hot-toast';

/* ── UTILS ── */
function esc(s) { return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return timeStr;
  const diff = Math.floor((now - d) / 86400000);
  const dayStr = diff < 7
    ? d.toLocaleDateString([], { weekday: 'short' })
    : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  //return `${dayStr} ${timeStr}`;  // e.g. "Wed 10:33 PM"
  return `${timeStr}`; // e.g. "10:33 PM"
}
function fmtDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  // For older messages include the day name e.g. "Wednesday, May 13"
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDur(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:
   ${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function avatarSrc(pic) {
  if (!pic) return null; return
  resolveUrl(pic.startsWith('http') ? pic : `${API_BASE}${pic}`);
}

function highlight(text, query) {
  if (!query) return text;
  return text.replace(new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
    '<mark style="background:transparent;color:var(--accent)">$1</mark>');
}

// Ported from ChannelView.js's voice-note implementation, which captures
// real amplitude data at record time instead of rendering a fixed
// decorative shape for every voice note — see the full rationale on
// ChannelVoiceBubble below.
const SPEED_STEPS = [1, 1.25, 1.5, 2, 0.5, 0.75];
const WAVE_BAR_COUNT = 28; // matches this file's previous fixed-bar count

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}
function seededPeaks(seed, count) {
  let s = seed;
  const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: count }, () => 0.25 + next() * 0.65);
}
function parsePeaks(json) {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch {
    return null;
  }
}
function sampleAmplitudeOnce(analyser, dataBuf) {
  analyser.getByteTimeDomainData(dataBuf);
  let peak = 0;
  for (let i = 0; i < dataBuf.length; i++) {
    const v = Math.abs(dataBuf[i] - 128) / 128;
    if (v > peak) peak = v;
  }
  return peak;
}
function downsamplePeaks(raw, count) {
  if (!raw || raw.length === 0) return null;
  const blockSize = Math.max(1, Math.ceil(raw.length / count));
  const peaks = [];
  for (let i = 0; i < count; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize && start + j < raw.length; j++) {
      if (raw[start + j] > max) max = raw[start + j];
    }
    peaks.push(start < raw.length ? max : (peaks[peaks.length - 1] ?? 0));
  }
  const peakMax = Math.max(...peaks, 0.02);
  return peaks.map(p => Math.round((p / peakMax) * 1000) / 1000);
}
const waveformCache = new Map();
function computeWaveform(src) {
  if (waveformCache.has(src)) return waveformCache.get(src);
  const promise = (async () => {
    try {
      const res = await fetch(src);
      const arrayBuf = await res.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const audioBuf = await new Promise((resolve, reject) => {
        const maybePromise = ctx.decodeAudioData(arrayBuf, resolve, reject);
        if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject);
      });
      const raw = audioBuf.getChannelData(0);
      const blockSize = Math.max(1, Math.floor(raw.length / WAVE_BAR_COUNT));
      const peaks = [];
      for (let i = 0; i < WAVE_BAR_COUNT; i++) {
        const start = i * blockSize;
        let max = 0;
        for (let j = 0; j < blockSize && start + j < raw.length; j++) {
          const v = Math.abs(raw[start + j]);
          if (v > max) max = v;
        }
        peaks.push(max);
      }
      const peakMax = Math.max(...peaks, 0.02);
      if (ctx.close) ctx.close();
      return peaks.map(p => p / peakMax);
    } catch {
      return null;
    }
  })();
  waveformCache.set(src, promise);
  return promise;
}
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

/* == GROUP INFO ICONS == */
const IcPhoneCall = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const IcVideoCam = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
const IcSearch20 = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IcImages = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;
const IcStar = ({ filled } = {}) => <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="18" height="18"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
const IcBookmark = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>;
const IcBell = ({ off } = {}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">{off && <line x1="1" y1="1" x2="23" y2="23" />}<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
const IcLock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const IcClock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const IcShield = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
const IcSliders = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>;
const IcLink = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
const IcHistory = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
const IcHeart = ({ filled } = {}) => <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
const IcListPlus = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="11" y1="12" x2="3" y2="12" /><line x1="16" y1="6" x2="3" y2="6" /><line x1="16" y1="18" x2="3" y2="18" /><line x1="21" y1="9" x2="21" y2="15" /><line x1="18" y1="12" x2="24" y2="12" /></svg>;
const IcEraser = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M20 20H7L3 16l10-10 8 8-6 6" /><path d="M13 6l5 5" /></svg>;
const IcFlag = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>;
const IcChevronR = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="9 18 15 12 9 6" /></svg>;
const IcUserPlus20 = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>;

/* ── TICK SVG ── */
function Tick({ status }) {
  if (status === 'SENT') return (
    <span className="msg-tick">
      <svg viewBox="0 0 16 10" fill="none"><path d="M1 5L5 9L11 1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
  return (
    <span className="msg-tick">
      <span className={status === 'READ' ? 'tick-read' : undefined}>
        <svg viewBox="0 0 16 10" fill="none">
          <path d="M1 5L5 9L11 1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 5L9 9L15 1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}

/* ── VOICE BUBBLE ──
   Waveform accuracy, in priority order (see ChannelVoiceBubble in
   ChannelView.js, where this was ported from, for the full rationale):
    1. waveformPeaks — real amplitude captured live at record time.
    2. computeWaveform(src) — best-effort decode of the uploaded file,
       for voice notes sent before waveformPeaks existed.
    3. A deterministic per-message placeholder while (2) is in flight
       or fails. */
function VoiceBubble({ src, durationHint = 0, waveformPeaks }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [pitchSynced, setPitchSynced] = useState(true);
  const [peaks, setPeaks] = useState(() => parsePeaks(waveformPeaks) || seededPeaks(hashString(src || ''), WAVE_BAR_COUNT));
  const total = WAVE_BAR_COUNT;

  useEffect(() => {
    const real = parsePeaks(waveformPeaks);
    if (real) { setPeaks(real); return; }
    let cancelled = false;
    setPeaks(seededPeaks(hashString(src || ''), WAVE_BAR_COUNT));
    if (src) {
      computeWaveform(src).then(decoded => {
        if (!cancelled && decoded) setPeaks(decoded);
      });
    }
    return () => { cancelled = true; };
  }, [src, waveformPeaks]);

  function trySetDur(d) { if (d && isFinite(d) && d > 0) setDuration(d); }
  function handleMeta(e) { trySetDur(e.target.duration); }
  function handleDurationChange(e) { trySetDur(e.target.duration); }
  function handleTimeUpdate(e) { setCurrent(e.target.currentTime); trySetDur(e.target.duration); }

  function applyAudioSettings(a, idx = speedIdx, synced = pitchSynced) {
    if (!a) return;
    a.playbackRate = SPEED_STEPS[idx];
    const preserve = !synced;
    a.preservesPitch = preserve;
    a.mozPreservesPitch = preserve;
    a.webkitPreservesPitch = preserve;
  }
  useEffect(() => { applyAudioSettings(audioRef.current); }, [speedIdx, pitchSynced]);

  function toggle() {
    const a = audioRef.current; if (!a) return;
    document.querySelectorAll('audio').forEach(x => { if (x !== a) x.pause(); });
    if (a.paused) {
      if (!(duration > 0) && a.readyState < 1) { a.load(); }
      applyAudioSettings(a);
      a.play().then(() => setPlaying(true)).catch(() => { });
    } else { a.pause(); setPlaying(false); }
  }
  function cycleSpeed(e) { e.stopPropagation(); setSpeedIdx(i => (i + 1) % SPEED_STEPS.length); }
  function togglePitchSync(e) { e.stopPropagation(); setPitchSynced(s => !s); }

  const displayDur = duration > 0 ? duration : (durationHint > 0 ? durationHint : null);
  const played = displayDur && displayDur > 0 ? Math.round((current / displayDur) * total) : 0;
  const durLabel = playing ? fmtDur(current) : (displayDur ? fmtDur(displayDur) : null);
  const speedLabel = `${SPEED_STEPS[speedIdx]}x`;

  return (
    <div className="bubble-voice">
      <button className="voice-play-btn" onClick={toggle}>{playing ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>}</button>
      <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={handleMeta} onDurationChange={handleDurationChange} onTimeUpdate={handleTimeUpdate} onEnded={() => { setPlaying(false); setCurrent(0); }} />
      <div className="voice-wave-wrap">
        <div className="voice-waveform">{peaks.map((p, i) => (
          <span key={i} className={`voice-bar${i < played ? ' played' : ''}`} style={{ height: Math.round(3 + p * 17) }} />
        ))}</div>
        {durLabel && <span className="voice-duration">{durLabel}</span>}
      </div>
      <button className="voice-speed-btn" onClick={cycleSpeed} title="Playback speed — click to change">{speedLabel}</button>
      <button
        className={`voice-pitch-btn${pitchSynced ? ' active' : ''}`}
        onClick={togglePitchSync}
        title={pitchSynced ? 'Pitch synced to speed (chipmunk/beast) — click to keep pitch normal' : 'Pitch stays normal — click to sync pitch with speed'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h3l2 5 4-16 3 11 2-5h4" /></svg>
      </button>
    </div>
  );
}

/* ── RENDER TEXT WITH CLICKABLE LINKS ── */
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;
function renderText(text) {
  if (!text) return null;
  const parts = text.split(URL_PATTERN);
  return parts.map((part, i) => {
    if (URL_PATTERN.test(part)) {
      URL_PATTERN.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer noopener"
          onClick={e => e.stopPropagation()}
          style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.45)', textUnderlineOffset: 2, overflowWrap: 'anywhere' }}>
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ── Typewriter reveal ──────────────────────────────────────────────────────
   Plays once when a bubble first mounts with _justArrived set (a message
   that just arrived live, sent or received — not one loaded from history).
   If the underlying text changes later (an edit), it just snaps to the new
   text instead of re-typing. */
function TypewriterText({ text, speed = 22 }) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!text) { setCount(0); doneRef.current = true; return; }
    let i = 0;
    const id = setInterval(() => {
      i++;
      setCount(i);
      if (i >= text.length) {
        clearInterval(id);
        doneRef.current = true;
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (doneRef.current) setCount(text ? text.length : 0);
  }, [text]);

  const revealed = text ? text.slice(0, count) : '';
  const finished = !text || count >= text.length;
  return (
    <>
      {renderText(revealed)}
      {!finished && <span className="typing-caret" aria-hidden="true" />}
    </>
  );
}

/* ── BUBBLE ── */
function Bubble({ msg, isSent, onContextMenu, isGroup, groupCreatorId, selectMode, isSelected, onSelect }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isDeleted = msg.type === 'DELETE';
  const msgType = (msg.type || 'TEXT').toUpperCase();
  const timeStr = fmtTime(msg.sentAt ?? msg.createdAt);
  const fileSrc = msg.fileUrl ? resolveUrl(msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_BASE}${msg.fileUrl}`) : null;

  // Sender info — GroupMessageDTO has senderAvatar/senderDisplayName/senderUsername
  // DM received messages don't carry this so avatar/name are omitted
  const senderName = msg.senderDisplayName || msg.senderUsername || null;
  const senderAvatar = msg.senderAvatar
    ? resolveUrl(msg.senderAvatar.startsWith('http') ? msg.senderAvatar : `${API_BASE}${msg.senderAvatar}`)
    : null;
  const senderInitials = senderName ? senderName.slice(0, 2).toUpperCase() : '?';

  // Only show avatar on received group messages
  const showAvatar = !isSent && isGroup && senderName;

  const hasEdited = !!msg.edited;
  // gap width matches footer: with "edited" = 106px, without = 72px
  const gap = <span className={`bubble-gap${hasEdited ? '' : ' short'}`} />;
  const footer = (
    <span className="bubble-footer">
      {hasEdited && <span className="bubble-edited">Edited</span>}
      <span className="bubble-time">{timeStr}</span>
      {isSent && <Tick status={msg.status || 'SENT'} />}
    </span>
  );

  const isMedia = msgType === 'IMAGE' || msgType === 'GIF' || msgType === 'VIDEO';
  const lightboxItems = isMedia && fileSrc ? [{ src: fileSrc, type: msgType }] : [];

  let inner;
  if (isDeleted) { inner = <><span className="bubble-deleted">⊘ This message was deleted</span><span className="bubble-gap short" /><span className="bubble-footer"><span className="bubble-time">{timeStr}</span></span></>; }
  else if (msgType === 'IMAGE' || msgType === 'GIF') { inner = <>{msg.replyToId && <div className="bubble-reply-quote">{msg.replyPreview}</div>}<div className="bubble-media-frame" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setLightboxOpen(true); }}><img className="bubble-media" src={fileSrc} alt="img" loading="lazy" /><span className="bubble-media-overlay">{hasEdited && <span className="bubble-edited">Edited</span>}<span className="bubble-time">{timeStr}</span>{isSent && <Tick status={msg.status || 'SENT'} />}</span></div>{msg.content && <span className="bubble-inner">{msg._justArrived ? <TypewriterText text={msg.content} /> : msg.content}</span>}</>; }
  else if (msgType === 'VIDEO') { inner = <>{msg.replyToId && <div className="bubble-reply-quote">{msg.replyPreview}</div>}<div className="bubble-media-frame" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setLightboxOpen(true); }}><video className="bubble-media" src={fileSrc} /><span className="bubble-media-overlay">{hasEdited && <span className="bubble-edited">Edited</span>}<span className="bubble-time">{timeStr}</span>{isSent && <Tick status={msg.status || 'SENT'} />}<svg viewBox="0 0 24 24" fill="white" width="20" height="20" style={{ marginLeft: 4 }}><polygon points="5,3 19,12 5,21" /></svg></span></div>{msg.content && <span className="bubble-inner">{msg._justArrived ? <TypewriterText text={msg.content} /> : msg.content}</span>}</>; }
  else if (msgType === 'VOICE') { inner = <div className="bubble-voice-wrap">{msg.replyToId && <div className="bubble-reply-quote">{msg.replyPreview}</div>}<VoiceBubble src={fileSrc} durationHint={msg.durationSeconds ? Number(msg.durationSeconds) : 0} waveformPeaks={msg.waveformPeaks} /><div className="bubble-voice-footer">{msg.edited && <span className="bubble-edited">edited ·</span>}<span className="bubble-time">{timeStr}</span>{isSent && <Tick status={msg.status || 'SENT'} />}</div></div>; }
  else if (msgType === 'FILE') { inner = <>{msg.replyToId && <div className="bubble-reply-quote">{msg.replyPreview}</div>}<a className="bubble-file" href={fileSrc} target="_blank" rel="noreferrer" download><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg><span>{fileSrc?.split('/').pop()}</span></a><span className="bubble-inner" style={{ display: 'block', minHeight: 4 }} />{footer}</>; }
  else if (msgType === 'CALL') { inner = <span className="bubble-call"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.39 18a19.5 19.5 0 0 1-3.39-3.39A19.79 19.79 0 0 1 2.12 6.18 2 2 0 0 1 4.11 4h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 4 4l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 20 16z" /></svg>{msg.content}{footer}</span>; }
  else {
    const linkUrl = (!isDeleted && msgType === 'TEXT') ? extractFirstUrl(msg.content) : null;
    const hasUrl = !!linkUrl || (msg.content && /(https?:\/\/)/i.test(msg.content));
    inner = (
      <>
        {msg.replyToId && <div className="bubble-reply-quote">{msg.replyPreview}</div>}
        <span className="bubble-inner">{msg._justArrived ? <TypewriterText text={msg.content} /> : renderText(msg.content)}{gap}</span>
        {linkUrl && <LinkPreview url={linkUrl} isSent={isSent} />}
        {footer}
      </>
    );
  }

  return (
    <div className={`bubble-row${isSent ? ' sent' : ' received'}`} data-msgid={msg.id}>
      {lightboxOpen && lightboxItems.length > 0 && <Lightbox items={lightboxItems} startIndex={0} onClose={() => setLightboxOpen(false)} />}
      {showAvatar && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginRight: 6, flexShrink: 0 }}>
          <UserAvatar
            src={msg.senderAvatar}
            name={senderName}
            userId={msg.senderId}
            size={28}
          />
        </div>
      )}
      {selectMode && (
        <div style={{ display: 'flex', alignItems: 'center', marginRight: isSent ? 0 : 6, marginLeft: isSent ? 6 : 0, order: isSent ? 1 : -1, flexShrink: 0 }}>
          <div onClick={e => { e.stopPropagation(); onSelect?.(msg.id); }} style={{
            width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--accent)',
            background: isSelected ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.12s',
          }}>
            {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" width="12" height="12"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
        </div>
      )}
      {showAvatar ? (
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 'calc(70% - 36px)', alignItems: 'flex-start' }}
          onClick={selectMode ? e => { e.stopPropagation(); onSelect?.(msg.id); } : undefined}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2, paddingLeft: 2, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 3 }}>
            {groupCreatorId && msg.senderId && String(msg.senderId) === String(groupCreatorId) && (
              <span title="Group creator" style={{ fontSize: 11, lineHeight: 1 }}>👑</span>
            )}
            {senderName}
          </span>
          <div className={`bubble${isDeleted ? ' deleted' : ''}${isSelected ? ' bubble-selected' : ''}${isMedia ? ' bubble-has-media' : ''}${msg._justArrived ? ' bubble-fresh' : ''}`}
            onContextMenu={selectMode || isDeleted ? undefined : onContextMenu}
            style={isSelected ? { outline: '2px solid var(--accent)', outlineOffset: 2 } : undefined}>
            {inner}
          </div>
        </div>
      ) : (
        <div className={`bubble${isDeleted ? ' deleted' : ''}${isSelected ? ' bubble-selected' : ''}${isMedia ? ' bubble-has-media' : ''}${msg._justArrived ? ' bubble-fresh' : ''}`}
          onContextMenu={selectMode || isDeleted ? undefined : onContextMenu}
          onClick={selectMode ? e => { e.stopPropagation(); onSelect?.(msg.id); } : undefined}
          style={isSelected ? { outline: '2px solid var(--accent)', outlineOffset: 2 } : undefined}>
          {inner}
        </div>
      )}
    </div>
  );
}

/* ── LIGHTBOX ── */
function Lightbox({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const item = items[idx];
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, items.length - 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [items.length, onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#fff', fontSize: 32, cursor: 'pointer', lineHeight: 1, padding: '0 8px' }}>×</button>
      {items.length > 1 && idx > 0 && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
      )}
      {items.length > 1 && idx < items.length - 1 && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      )}
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item && item.type === 'VIDEO'
          ? <video src={item.src} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
          : item && <img src={item.src} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
        }
      </div>
      {items.length > 1 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{idx + 1} / {items.length}</div>
      )}
    </div>
  );
}

/* ── BUNDLE MEDIA TILE (hoisted to avoid remount on every render) ── */
function BundleTile({ src, type, extraCount, showBadge, width, height, onClick }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 4, cursor: 'pointer', width, height, flexShrink: 0 }} onClick={onClick}>
      {type === 'VIDEO'
        ? <video src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
        : <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
      }
      {showBadge && extraCount > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' }}>+{extraCount}</div>
      )}
    </div>
  );
}

/* ── BUBBLE BUNDLE (WhatsApp-style media grid) ── */
function BubbleBundle({ msgs, isSent, onContextMenu, groupCreatorId }) {
  const [lightbox, setLightbox] = useState(null);

  const mediaItems = msgs.map(msg => ({
    src: msg.fileUrl ? resolveUrl(msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_BASE}${msg.fileUrl}`) : null,
    type: (msg.type || 'TEXT').toUpperCase(),
    msg,
  }));
  const count = mediaItems.length;
  const caption = msgs.find(m => m.content)?.content;
  const timeStr = fmtTime(msgs[msgs.length - 1].sentAt ?? msgs[msgs.length - 1].createdAt);

  const SIZE = 220;
  const GAP = 2;
  const HALF = (SIZE - GAP) / 2;
  const show = Math.min(count, 4);
  const extras = count - 4;

  const t = (i, w, h, badge) => (
    <BundleTile key={i} src={mediaItems[i].src} type={mediaItems[i].type}
      width={w} height={h} extraCount={extras + 1} showBadge={badge}
      onClick={e => { e.stopPropagation(); setLightbox(i); }} />
  );

  let grid;
  if (show === 1) {
    grid = t(0, SIZE, SIZE, false);
  } else if (show === 2) {
    grid = <div style={{ display: 'flex', gap: GAP }}>{t(0, HALF, SIZE, false)}{t(1, HALF, SIZE, false)}</div>;
  } else if (show === 3) {
    grid = <div style={{ display: 'flex', gap: GAP }}>
      {t(0, HALF, SIZE, false)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>{t(1, HALF, HALF, false)}{t(2, HALF, HALF, false)}</div>
    </div>;
  } else {
    grid = <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      <div style={{ display: 'flex', gap: GAP }}>{t(0, HALF, HALF, false)}{t(1, HALF, HALF, false)}</div>
      <div style={{ display: 'flex', gap: GAP }}>{t(2, HALF, HALF, false)}{t(3, HALF, HALF, extras > 0)}</div>
    </div>;
  }

  const lightboxItems = mediaItems.map(m => ({ src: m.src, type: m.type }));

  return (
    <div className={`bubble-row${isSent ? ' sent' : ' received'}`} data-msgid={msgs[0].id}>
      {lightbox !== null && <Lightbox items={lightboxItems} startIndex={lightbox} onClose={() => setLightbox(null)} />}
      <div className="bubble" onContextMenu={e => onContextMenu(e, msgs[0], isSent)} data-creator={groupCreatorId}>
        <div style={{ borderRadius: 10, overflow: 'hidden', lineHeight: 0, display: 'inline-block', width: SIZE }}>{grid}</div>
        {caption && <span className="bubble-inner" style={{ display: 'block', paddingTop: 6 }}>{caption}</span>}
        <span className="bubble-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, padding: '2px 6px 4px', marginTop: caption ? 0 : 2 }}>
          <span className="bubble-time">{timeStr}</span>
          {isSent && <Tick status={msgs[msgs.length - 1].status || 'SENT'} />}
        </span>
      </div>
    </div>
  );
}


function ContextMenu({ x, y, msg, isSent, onReply, onEdit, onDelete, onCopy, onSelect, onClose }) {
  const isMedia = !!msg.fileUrl;
  const isDeleted = msg.type === 'DELETE';
  const hasText = !isDeleted && msg.content;
  useEffect(() => {
    const t = setTimeout(() => {
      const h = () => onClose();
      document.addEventListener('click', h, { once: true });
      return () => document.removeEventListener('click', h);
    }, 50);
    return () => clearTimeout(t);
  }, [onClose]);

  const items = [
    !isDeleted && { icon: <polyline points="9 17 4 12 9 7" />, icon2: <path d="M20 18v-2a4 4 0 0 0-4-4H4" />, label: 'Reply', action: () => { onReply(); onClose(); } },
    hasText && { icon: <rect x="9" y="9" width="13" height="13" rx="2" />, icon2: <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />, label: 'Copy', action: () => { onCopy(); onClose(); } },
    isSent && !isDeleted && !isMedia && { icon: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />, icon2: <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />, label: 'Edit', action: () => { onEdit(); onClose(); } },
    !isDeleted && { icon: <polyline points="9 11 12 14 22 4" />, icon2: <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />, label: 'Select', action: () => { onSelect(); onClose(); } },
    isSent && !isDeleted && { danger: true, icon: <polyline points="3 6 5 6 21 6" />, icon2: <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />, label: 'Delete', action: () => { onDelete(); onClose(); } },
  ].filter(Boolean);

  return (
    <div className="bubble-menu" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
      {items.map(item => (
        <button key={item.label} className={`bubble-menu-btn${item.danger ? ' danger' : ''}`} onClick={item.action}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            {item.icon}{item.icon2}
          </svg>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ── SELECTION ACTION BAR ── */
function SelectionBar({ count, onCopy, onDelete, onCancel, canDelete }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 10,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
        {count} selected
      </span>
      <button onClick={onCopy} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '4px 12px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        <span style={{ fontSize: 10, fontWeight: 600 }}>Copy</span>
      </button>
      {canDelete && (
        <button onClick={onDelete} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px 12px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
          <span style={{ fontSize: 10, fontWeight: 600 }}>Delete</span>
        </button>
      )}
      <button onClick={onCancel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 12px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        <span style={{ fontSize: 10, fontWeight: 600 }}>Cancel</span>
      </button>
    </div>
  );
}

/* ── GROUP MODAL ── */
function GroupModal({ userId, conversations, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  function submit() {
    if (!name.trim() || selected.length < 1) return;
    onCreate({ name: name.trim(), members: selected });
    onClose();
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 600 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 360, background: 'var(--bg-card)', borderRadius: 20, padding: 24, zIndex: 601, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>New Group</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name…"
          style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Add people</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
          {conversations.map(c => {
            const sel = selected.includes(c.userId);
            return (
              <div key={c.userId} onClick={() => toggle(c.userId)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 10, cursor: 'pointer', background: sel ? 'rgba(79,172,254,0.08)' : 'none', border: sel ? '1px solid var(--accent)' : '1px solid transparent', marginBottom: 4 }}>
                {avatarSrc(c.avatar)
                  ? <img src={avatarSrc(c.avatar)} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent-text)' }}>{(c.name || '?').slice(0, 2).toUpperCase()}</div>}
                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: sel ? 600 : 400 }}>{c.name || c.username}</span>
                {sel && <svg style={{ marginLeft: 'auto' }} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid var(--border-input)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={!name.trim() || selected.length < 1} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', cursor: 'pointer', fontWeight: 600, opacity: (!name.trim() || selected.length < 1) ? 0.5 : 1 }}>Create Group</button>
        </div>
      </div>
    </>
  );
}


/* ── DM SEARCH MODAL ── */
function DmSearchModal({ messages, userId, convoName, query, onQueryChange, onClose }) {
  const inputRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? messages.filter(m => {
      if (!m.content) return false;
      if ((m.type || 'TEXT').toUpperCase() === 'DELETE') return false;
      return m.content.toLowerCase().includes(q);
    })
    : [];

  function highlight(text, term) {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === term.toLowerCase()
        ? <mark key={i} style={{ background: 'rgba(79,172,254,0.28)', color: 'var(--accent)', borderRadius: 3, padding: '0 2px', fontWeight: 600 }}>{p}</mark>
        : p
    );
  }

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: mounted ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
        backdropFilter: mounted ? 'blur(6px)' : 'blur(0px)',
        transition: 'background 0.22s ease, backdrop-filter 0.22s ease',
        padding: '20px 16px',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
          overflow: 'hidden',
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.26s cubic-bezier(0.32,0.72,0,1), opacity 0.22s ease',
        }}>
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16"
            style={{ color: 'var(--accent)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={`Search in conversation\u2026`}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}
          />
          {q && results.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '2px 8px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={() => { if (query) onQueryChange(''); else onClose(); }} style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', cursor: 'pointer',
            width: 26, height: 26, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!q && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 32px', gap: 10 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24" style={{ color: 'var(--text-muted)' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Search messages</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                Find anything in your conversation with <strong style={{ color: 'var(--text-secondary)' }}>{convoName}</strong>
              </span>
            </div>
          )}
          {q && results.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 32px', gap: 10 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24" style={{ color: 'var(--text-muted)' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No messages found</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Nothing matches <strong style={{ color: 'var(--text-secondary)' }}>"{query.trim()}"</strong>
              </span>
            </div>
          )}
          {results.length > 0 && (
            <div style={{ padding: '6px 0 8px' }}>
              {results.map((msg, idx) => {
                const isSent = msg.senderId === userId;
                const timeStr = fmtTime(msg.sentAt ?? msg.createdAt);
                const dateStr = fmtDateLabel(msg.sentAt ?? msg.createdAt);
                const showDate = idx === 0 || fmtDateLabel(results[idx - 1].sentAt ?? results[idx - 1].createdAt) !== dateStr;
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 4px' }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{dateStr}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                    )}
                    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start', gap: 2 }}>
                      <div className={`bubble-row${isSent ? ' sent' : ' received'}`} style={{ margin: 0 }}>
                        <div className="bubble" style={{ cursor: 'default', maxWidth: '80%' }}>
                          <span className="bubble-inner">
                            {highlight(msg.content, q)}
                            <span className="bubble-gap short" />
                          </span>
                          <span className="bubble-footer">
                            <span className="bubble-time">{timeStr}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 10, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}


/* ── MAIN MESSAGES PAGE ── */
export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const activeConvoRef = useRef(null); // always has latest activeConvo for WS handler
  const [messages, setMessages] = useState([]);
  // Clears the "just arrived" flag (used for the typewriter/pop-in effect)
  // a little after a message lands, so it never replays if the row's key
  // later changes (e.g. an optimistic tmpId resolving to a real id) or the
  // list re-renders for an unrelated reason.
  const scheduleClearJustArrived = useCallback((key) => {
    if (!key) return;
    setTimeout(() => {
      setMessages(prev => prev.map(m => (m.id === key || m._tmpId === key) ? { ...m, _justArrived: false } : m));
    }, 1500);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPeople, setSearchPeople] = useState([]);
  const [msgFilter, setMsgFilter] = useState('all');
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState({});
  const [activeStatus, setActiveStatus] = useState(null);
  const [viewingGroupInfo, setViewingGroupInfo] = useState(null);
  const [myProfileOpen, setMyProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [dmSearchActive, setDmSearchActive] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  // Pinned convo ids
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('omni_pinned') || '[]'); } catch { return []; }
  });
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, convo }
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const recTimerRef = useRef(null);
  // Live-amplitude capture while recording — an AnalyserNode on the mic
  // stream, sampled a few times a second, ported from ChannelView.js's
  // voice notes so DM voice notes get a real waveform too instead of a
  // decorative placeholder.
  const analyserRef = useRef(null);
  const ampCtxRef = useRef(null);
  const ampHistoryRef = useRef([]);
  const ampTimerRef = useRef(null);
  const searchTimerRef = useRef(null);

  /* ── Call context ── */
  const {
    startCall, endCall, declineCall, acceptCall,
    status: callStatus, callType, remoteUser: callRemoteUser,
  } = useCall();

  /* ── WS handler ── */
  const handleWsMessage = (msg) => {
    // Normalize — server sends PRESENCE with _type, call signals with type
    const msgType = msg._type || msg.type;

    if (msgType === 'PRESENCE') {
      const { userId: uid, online } = msg;
      setOnlineUsers(prev => ({ ...prev, [uid]: online }));
      setActiveConvo(ac => {
        if (ac?.userId === uid) setActiveStatus(online ? 'Online' : 'Offline');
        return ac;
      });
      setConversations(prev => prev.map(cv => cv.userId === uid ? { ...cv, online } : cv));
      return;
    }
    // WebRTC signaling is handled exclusively by CallContext — drop here
    if (msgType === 'CALL_OFFER' || msgType === 'CALL_INCOMING' ||
      msgType === 'CALL_ANSWER' || msgType === 'CALL_ICE' ||
      msgType === 'CALL_DECLINE' || msgType === 'CALL_DECLINED' ||
      msgType === 'CALL_END' || msgType === 'CALL_ENDED') return;

    // Group message — has groupId field from GroupMessageDTO
    if (msg.groupId) {
      const gKey = `group_${msg.groupId}`;
      if (activeConvoRef.current && Number(activeConvoRef.current.groupId) === Number(msg.groupId)) {
        // Handle DELETE — must come before dedup check since the id already exists
        if (msg.type === 'DELETE') {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, type: 'DELETE', content: null } : m));
          return;
        }
        // Handle EDIT
        if (msg.type === 'EDIT') {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, edited: true } : m));
          return;
        }
        setMessages(prev => {
          // Dedup: don't add if message with same id already exists
          if (msg.id && prev.some(m => m.id === msg.id)) return prev;
          // Replace optimistic message from self — match by _tmpId (exact)
          if (String(msg.senderId) === String(userIdRef.current)) {
            const tmpId = msg._tmpId;
            const idx = tmpId
              ? prev.findIndex(m => m._optimistic && m._tmpId === tmpId)
              : prev.findIndex(m => m._optimistic && m.senderId === msg.senderId && m.content === msg.content);
            if (idx !== -1) {
              return prev.map((m, i) => i === idx ? { ...msg, status: 'SENT', _optimistic: false, _justArrived: m._justArrived } : m);
            }
          }
          scheduleClearJustArrived(msg.id);
          return [...prev, { ...msg, status: 'SENT', _justArrived: true }];
        });
      }
      if (msg.type !== 'DELETE' && msg.type !== 'EDIT') {
        bumpConvo(gKey, msg.senderDisplayName ? `${msg.senderDisplayName}: ${msg.content || '[attachment]'}` : msg.content || '[attachment]');
      }
      return;
    }
    const type = msg.type;
    const otherId = msg.senderId === userIdRef.current ? msg.receiverId : msg.senderId;
    if (type === 'READ_RECEIPT') {
      setMessages(prev => prev.map(m => m.senderId === msg.senderId && m.receiverId === msg.receiverId ? { ...m, status: 'READ' } : m));
      return;
    }
    if (type === 'EDIT') { setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, edited: true } : m)); bumpConvo(otherId, msg.content); return; }
    if (type === 'DELETE') { setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, type: 'DELETE' } : m)); return; }
    // Only append to messages if this convo is currently open
    const ac = activeConvoRef.current;
    const thisUserId = userIdRef.current;
    const otherParty = msg.senderId === thisUserId ? msg.receiverId : msg.senderId;
    if (ac && !ac.isGroup && (String(ac.userId) === String(otherParty))) {
      setMessages(prev => {
        // Dedup: skip if real id already exists
        if (msg.id && prev.some(m => m.id === msg.id)) return prev;
        // Replace optimistic placeholder from self — match by _tmpId (exact), not content
        if (msg.senderId === thisUserId) {
          const tmpId = msg._tmpId;
          const idx = tmpId
            ? prev.findIndex(m => m._optimistic && m._tmpId === tmpId)
            : prev.findIndex(m => m._optimistic && m.senderId === msg.senderId && m.content === msg.content && !prev.some(p => p.id === msg.id));
          if (idx !== -1) {
            return prev.map((m, i) => i === idx ? { ...msg, status: 'SENT', _optimistic: false, _justArrived: m._justArrived } : m);
          }
        }
        scheduleClearJustArrived(msg.id);
        return [...prev, { ...msg, status: msg.senderId !== thisUserId ? 'READ' : (msg.status || 'SENT'), _justArrived: true }];
      });
    }
    bumpConvo(otherId, msg.content || '[attachment]');
  };

  const { publish, subscribeToGroup } = useWebSocket(userId, handleWsMessage);
  const publishRef = useRef(publish);
  const subscribeToGroupRef = useRef(subscribeToGroup);
  useEffect(() => { publishRef.current = publish; }, [publish]);
  useEffect(() => { subscribeToGroupRef.current = subscribeToGroup; }, [subscribeToGroup]);
  
  // Safe wrapper — always calls the latest publish, never throws if not ready

  const send = useCallback((dest, body) => {
    const fn = publishRef.current;
    if (typeof fn === 'function') {
      try {
        fn(dest, body);
      } catch (err) {
        console.error("WebSocket Send Error:", err);
        toast.error("Failed to send: WebSocket error.");
      }
    } else {
      console.warn("WebSocket is disconnected. Message dropped:", body);
      toast.error("Disconnected! Make sure your backend/tunnel is running.");
    }
  }, []);

  /* ── Load conversations ── */
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      api.getConversations(userId).catch(() => []),
      groupApi.getForUser(userId).catch(() => []),
    ]).then(([dmConvos, groups]) => {
      const groupConvos = groups.map(dto => ({
        userId: `group_${dto.id}`,
        groupId: dto.id,
        name: dto.name, isGroup: true,
        members: dto.members,
        creatorId: dto.creatorId,
        permEditSettings: dto.permEditSettings,
        permSendMessages: dto.permSendMessages,
        permAddMembers: dto.permAddMembers,
        avatar: dto.avatarUrl || null,
        lastMsg: '',
        lastTime: null,
        unread: 0,
      }));
      setConversations([...dmConvos, ...groupConvos]);
      setOnlineUsers({});
      // Subscribe to WS topic for every group the user belongs to
      groupConvos.forEach(g => subscribeToGroupRef.current?.(g.groupId));
    });
    api.setPresence(userId, true);
    setTimeout(() => { try { send('/app/presence', { userId, online: true }); } catch { } }, 1000);
    const bye = () => { api.setPresence(userId, false); try { send('/app/presence', { userId, online: false }); } catch { } };
    window.addEventListener('beforeunload', bye);
    return () => window.removeEventListener('beforeunload', bye);
  }, [userId]);

  /* ── Load history when convo opens ── */
  useEffect(() => {
    if (!activeConvo || !userId) return;
    if (activeConvo.isGroup && activeConvo.groupId) {
      groupApi.getMessages(activeConvo.groupId).then(msgs => setMessages(msgs)).catch(() => { });
    } else {
      api.getHistory(userId, activeConvo.userId).then(msgs => { setMessages(msgs); sendReadReceipt(activeConvo.userId); }).catch(() => { });
    }
    setActiveStatus('Offline');
  }, [activeConvo?.userId, userId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function sendReadReceipt(otherUserId) { send('/app/message.read', { senderId: otherUserId, receiverId: userId }); }

  function bumpConvo(otherId, preview) {
    setConversations(prev => {
      const idx = prev.findIndex(c => String(c.userId) === String(otherId));
      if (idx === -1) return prev;
      const updated = { ...prev[idx], lastMsg: preview, lastTime: new Date().toISOString() };
      const rest = prev.filter((_, i) => i !== idx);
      return [updated, ...rest];
    });
  }

  /* ── Search ── */
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchPeople([]); return; }
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try { const r = await api.searchUsers(searchQuery); setSearchPeople(r.filter(u => u.id !== userId)); } catch { }
    }, 300);
  }, [searchQuery, userId]);

  function openConvo(convo) {
    activeConvoRef.current = convo;
    setActiveConvo(convo); setSearchQuery(''); setSearchPeople([]); setReplyingTo(null); setMessages([]); setDmSearchActive(false); setDmSearchQuery('');
    setConversations(prev => prev.map(c => c.userId === convo.userId ? { ...c, unread: 0 } : c));
    if (convo.isGroup && convo.groupId) subscribeToGroupRef.current?.(convo.groupId);
    setSelectMode(false); setSelectedIds(new Set());
  }
  function startConvoWithUser(u2) {
    let convo = conversations.find(c => c.userId === u2.id);
    if (!convo) { convo = { userId: u2.id, name: u2.displayName || u2.username, username: u2.username, avatar: u2.profilePicture, lastMsg: '', lastTime: null, unread: 0 }; setConversations(prev => [convo, ...prev]); }
    openConvo(convo);
  }

  /* ── Pin ── */
  function togglePin(userId) {
    setPinnedIds(prev => {
      const next = prev.includes(userId) ? prev.filter(x => x !== userId) : [...prev, userId];
      localStorage.setItem('omni_pinned', JSON.stringify(next));
      return next;
    });
  }

  /* ── Group ── */
  async function createGroup({ name, members }) {
    try {
      // members already excludes self (filtered in GroupModal)
      const dto = await groupApi.create(name, members);
      const groupConvo = {
        userId: `group_${dto.id}`,
        groupId: dto.id,
        name: dto.name, isGroup: true,
        members: dto.members,
        creatorId: dto.creatorId,
        avatar: dto.avatarUrl || null,
        lastMsg: 'Group created',
        lastTime: new Date().toISOString(),
        unread: 0,
      };
      setConversations(prev => [groupConvo, ...prev]);
      openConvo(groupConvo);
    } catch (e) { console.error('Group create failed', e); }
  }

  /* ── Send ── */
  async function sendMessage() {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    if (!activeConvo) return;
    if (attachments.length > 0) {
      // Send each attachment; caption goes only on the first one
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        const fd = new FormData();
        fd.append('file', att.file);
        if (activeConvo.isGroup && activeConvo.groupId) {
          fd.append('groupId', activeConvo.groupId);
        } else {
          fd.append('receiverId', activeConvo.userId);
        }
        fd.append('type', att.kind);
        if (i === 0 && content) fd.append('content', content);
        if (replyingTo) { fd.append('replyToId', replyingTo.id); fd.append('replyPreview', replyingTo.content?.slice(0, 200)); }
        try { await api.uploadMessage(fd); } catch (e) { console.error(e); }
      }
      setAttachments([]); setText(''); setReplyingTo(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }
    if (activeConvo.isGroup && activeConvo.groupId) {
      const _tmpId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const optimistic = {
        groupId: activeConvo.groupId,
        senderId: userId,
        content,
        type: 'TEXT',
        status: 'SENT',
        createdAt: new Date().toISOString(),
        _optimistic: true,
        _tmpId,
        _justArrived: true,
      };
      scheduleClearJustArrived(_tmpId);
      setMessages(prev => [...prev, optimistic]);
      send('/app/group.message', { groupId: activeConvo.groupId, content, type: 'TEXT', _tmpId });
    } else {
      // Optimistic insert for DMs so message shows immediately without waiting for WS echo
      const _tmpId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const optimistic = {
        senderId: userId,
        receiverId: activeConvo.userId,
        content,
        type: 'TEXT',
        status: 'SENT',
        sentAt: new Date().toISOString(),
        _optimistic: true,
        _tmpId,
        _justArrived: true,
      };
      if (replyingTo) { optimistic.replyToId = replyingTo.id; optimistic.replyPreview = replyingTo.content?.slice(0, 200); }
      scheduleClearJustArrived(_tmpId);
      setMessages(prev => [...prev, optimistic]);
      const payload = { receiverId: activeConvo.userId, content, type: 'TEXT', _tmpId };
      if (replyingTo) { payload.replyToId = replyingTo.id; payload.replyPreview = replyingTo.content?.slice(0, 200); }
      send('/app/message.send', payload);
    }
    setText(''); setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function submitEdit(msgId) {
    if (!editText.trim()) return;
    send('/app/message.edit', { id: msgId, receiverId: activeConvo.userId, content: editText });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editText, edited: true } : m));
    setEditingId(null); setEditText('');
  }
  function deleteMessage(msgId) {
    if (activeConvo?.isGroup) {
      send('/app/group.message.delete', { messageId: msgId, groupId: activeConvo.groupId });
    } else {
      send('/app/message.delete', { id: msgId, receiverId: activeConvo.userId });
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, type: 'DELETE' } : m));
  }

  function toggleSelectMsg(msgId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  }

  function enterSelectMode(msg) {
    setSelectMode(true);
    setSelectedIds(new Set([msg.id]));
    setContextMenu(null);
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function copySelectedMessages() {
    const selected = messages
      .filter(m => selectedIds.has(m.id) && m.content && m.type !== 'DELETE')
      .map(m => m.content)
      .join('\n');
    navigator.clipboard?.writeText(selected).then(() => toast.success('Copied'));
    cancelSelect();
  }

  function deleteSelectedMessages() {
    selectedIds.forEach(id => deleteMessage(id));
    cancelSelect();
  }

  function copyMessage(msg) {
    if (msg.content) navigator.clipboard?.writeText(msg.content).then(() => toast.success('Copied'));
  }
  function pickFile(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return; e.target.value = '';
    const reads = files.map(file => new Promise(resolve => {
      const mime = file.type; let kind = 'FILE';
      if (mime.startsWith('image/gif')) kind = 'GIF';
      else if (mime.startsWith('image/')) kind = 'IMAGE';
      else if (mime.startsWith('video/')) kind = 'VIDEO';
      const reader = new FileReader();
      reader.onload = ev => resolve({ file, kind, dataUrl: ev.target.result });
      reader.readAsDataURL(file);
    }));
    Promise.all(reads).then(newAtts => setAttachments(prev => [...prev, ...newAtts]));
  }

  /* ── Voice recording ── */
  function startAmpSampling() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    ampTimerRef.current = setInterval(() => {
      ampHistoryRef.current.push(sampleAmplitudeOnce(analyser, data));
    }, 100);
  }
  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = ev => { if (ev.data.size > 0) chunks.push(ev.data); };
      mr._durationSnapshot = 0;

      ampHistoryRef.current = [];
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const actx = new AudioCtx();
        const srcNode = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 1024;
        srcNode.connect(analyser);
        ampCtxRef.current = actx;
        analyserRef.current = analyser;
        startAmpSampling();
      } catch {
        // Best-effort — upload just proceeds without waveformPeaks and the
        // bubble falls back to its other strategies.
      }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(ampTimerRef.current);
        if (ampCtxRef.current && ampCtxRef.current.close) ampCtxRef.current.close();
        const capturedDuration = mr._durationSnapshot;
        const waveformPeaks = downsamplePeaks(ampHistoryRef.current, WAVE_BAR_COUNT);
        setRecording(false); setPaused(false); setRecSeconds(0); clearInterval(recTimerRef.current);
        if (!mr._cancelled && chunks.length) {
          const blob = new Blob(chunks, { type: mime });
          if (blob.size > 1000) {
            const fd = new FormData();
            fd.append('file', new File([blob], `voice_${Date.now()}.webm`, { type: mime }));
            if (activeConvo?.isGroup && activeConvo.groupId) {
              fd.append('groupId', activeConvo.groupId);
            } else {
              fd.append('receiverId', activeConvo?.userId);
            }
            fd.append('type', 'VOICE'); fd.append('durationSeconds', String(capturedDuration || 0));
            if (waveformPeaks) fd.append('waveformPeaks', JSON.stringify(waveformPeaks));
            if (replyingTo) { fd.append('replyToId', replyingTo.id); fd.append('replyPreview', replyingTo.content?.slice(0, 200)); }
            try { await api.uploadMessage(fd); setReplyingTo(null); } catch { }
          }
        }
      };
      mr.start(100); recorderRef.current = mr; setRecording(true); setPaused(false);
      let s = 0;
      recTimerRef.current = setInterval(() => { s++; setRecSeconds(s); mr._durationSnapshot = s; if (s >= 300) sendRecording(); }, 1000);
    } catch (err) { console.error('Mic error:', err); setRecording(false); }
  }
  function pauseRecording() {
    const mr = recorderRef.current; if (!mr) return;
    if (mr.state === 'recording') {
      mr.pause(); setPaused(true);
      clearInterval(recTimerRef.current);
      clearInterval(ampTimerRef.current);
    } else if (mr.state === 'paused') {
      mr.resume(); setPaused(false);
      let s = recSeconds;
      recTimerRef.current = setInterval(() => { s++; setRecSeconds(s); mr._durationSnapshot = s; if (s >= 300) sendRecording(); }, 1000);
      startAmpSampling();
    }
  }
  function sendRecording() { clearInterval(recTimerRef.current); const mr = recorderRef.current; if (!mr || (mr.state !== 'recording' && mr.state !== 'paused')) return; mr.stop(); }
  function cancelRecording() {
    clearInterval(recTimerRef.current); clearInterval(ampTimerRef.current); const mr = recorderRef.current; if (!mr) return;
    mr._cancelled = true;
    if (mr.state === 'recording' || mr.state === 'paused') mr.stop();
    else { setRecording(false); setPaused(false); setRecSeconds(0); }
  }

  /* ── Context menu ── */
  function openContextMenu(e, msg, isSent) {
    e.preventDefault(); e.stopPropagation();
    let x = e.clientX, y = e.clientY;
    if (x + 150 > window.innerWidth) x = window.innerWidth - 158;
    if (y + 130 > window.innerHeight) y = window.innerHeight - 138;
    setContextMenu({ x, y, msg, isSent });
  }

  /* ── Render messages grouped by date ── */
  function renderMessages() {
    const items = []; let lastDate = null;
    const MEDIA_TYPES = new Set(['IMAGE', 'GIF', 'VIDEO']);
    const BUNDLE_GAP_MS = 10000; // 10s window for grouping

    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];
      const label = fmtDateLabel(msg.sentAt ?? msg.createdAt);
      if (label !== lastDate) { items.push(<div key={`d-${i}`} className="date-sep">{label}</div>); lastDate = label; }
      const isSent = msg.senderId === userId;

      // Try to bundle consecutive media from the same sender
      const mtype = (msg.type || 'TEXT').toUpperCase();
      if (MEDIA_TYPES.has(mtype) && !msg.replyToId && editingId !== msg.id) {
        const bundle = [msg];
        let j = i + 1;
        while (j < messages.length) {
          const next = messages[j];
          const nextType = (next.type || 'TEXT').toUpperCase();
          const sameDate = fmtDateLabel(next.sentAt ?? next.createdAt) === label;
          const sameSender = next.senderId === msg.senderId;
          const closeInTime = Math.abs(new Date(next.sentAt ?? next.createdAt) - new Date(msg.sentAt ?? msg.createdAt)) < BUNDLE_GAP_MS;
          const isMedia = MEDIA_TYPES.has(nextType);
          const noReply = !next.replyToId;
          const notEditing = editingId !== next.id;
          // Only the LAST message in bundle can have a caption; skip non-matching
          const hasContent = next.content && bundle[bundle.length - 1].content;
          if (sameSender && sameDate && closeInTime && isMedia && noReply && notEditing && !hasContent) {
            bundle.push(next); j++;
          } else break;
        }
        if (bundle.length > 1) {
          items.push(
            <BubbleBundle key={bundle[0].id}
              msgs={bundle} isSent={isSent}
              isGroup={!!(activeConvo?.isGroup)}
              groupCreatorId={activeConvo?.creatorId}
              onContextMenu={(e, m, s) => openContextMenu(e, m, s ?? isSent)}
            />);

          i = j; continue;
        }
      }

      if (editingId === msg.id) {
        items.push(
          <div key={msg._tmpId || msg.id} className={`bubble-row${isSent ? ' sent' : ' received'}`}>
            <div className="bubble">
              <input className="bubble-edit-input" value={editText} autoFocus onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitEdit(msg.id); if (e.key === 'Escape') setEditingId(null); }} onBlur={() => submitEdit(msg.id)} />
            </div>
          </div>
        );
      } else {
        items.push(<Bubble
          key={msg._tmpId || msg.id}
          msg={msg}
          isSent={isSent}
          isGroup={!!(activeConvo?.isGroup)}
          groupCreatorId={activeConvo?.creatorId}
          selectMode={selectMode}
          isSelected={selectedIds.has(msg.id)}
          onSelect={toggleSelectMsg}
          onContextMenu={e => openContextMenu(e, msg, isSent)}
        />);
      }
      i++;
    }
    return items;
  }

  /* ── Sorted conversation list: pinned first, then by time ── */
  const { friendIds } = useFriends();
  const sortedConvos = [...conversations].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.userId) ? 1 : 0;
    const bPinned = pinnedIds.includes(b.userId) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    return new Date(b.lastTime || 0) - new Date(a.lastTime || 0);
  }).filter(c => {
    if (msgFilter === 'groups') return c.isGroup;
    if (msgFilter === 'friends') return !c.isGroup && friendIds.has(Number(c.userId));
    return true;
  });

  const convoName = activeConvo?.name || activeConvo?.username || '';

  return (
    <div className={`messages-layout${activeConvo ? ' mobile-chat-open' : ''}`} style={{ flex: 1 }}>
      {/* ── Left panel ── */}
      <div className="convo-panel" style={{ width: sidebarOpen ? 300 : 0, minWidth: sidebarOpen ? 300 : 0, overflow: 'hidden', transition: 'width 0.25s ease,min-width 0.25s ease' }}>
        <div className="convo-panel-header">
          <div className="search-wrap" style={{ marginTop: 0 }}>
            <input className="search-input" placeholder="Search people…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>}
          </div>

          {/* Filter tabs */}
          {!searchQuery && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {['all', 'friends', 'groups'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setMsgFilter(tab)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: msgFilter === tab ? 'none' : '1px solid var(--border-input)',
                    background: msgFilter === tab ? 'var(--accent)' : 'var(--bg-input)',
                    color: msgFilter === tab ? 'var(--accent-text)' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="convo-list">
          {searchQuery && searchPeople.map(u => (
            <div key={u.id} className="people-item" onClick={() => startConvoWithUser(u)}>
              <div className="convo-avatar-wrap" style={{ position: 'relative' }}>
                <UserAvatar src={u.profilePicture} name={u.displayName || u.username} userId={u.id} size={42} />
                <span className={`online-dot${onlineUsers[u.id] ? ' online' : ''}`} style={{ position: 'absolute', bottom: 1, right: 1 }} />
              </div>
              <div>
                <div className="people-name" dangerouslySetInnerHTML={{ __html: highlight(esc(u.displayName || u.username), searchQuery) }} />
                <div className="people-username">@{u.username}</div>
              </div>
            </div>
          ))}

          {!searchQuery && sortedConvos.map(c => {
            const isPinned = pinnedIds.includes(c.userId);
            return (
              <div key={c.userId}
                className={`convo-item${activeConvo?.userId === c.userId ? ' active' : ''}`}
                onClick={() => openConvo(c)}
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, convo: c }); }}
              >
                <div className="convo-avatar-wrap" style={{ position: 'relative' }} onClick={e => { e.stopPropagation(); if (!c.isGroup) navigate(`/profile/${c.username}`); else setViewingGroupInfo(c); }}>
                  {c.isGroup
                    ? <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer' }}>
                      <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    </div>
                    : <UserAvatar src={c.avatar} name={c.name || c.username} userId={c.userId} size={44} />
                  }
                  {!c.isGroup && <span className={`online-dot${onlineUsers[c.userId] || c.online ? ' online' : ''}`} style={{ position: 'absolute', bottom: 1, right: 1 }} />}
                </div>
                <div className="convo-info">
                  <div className="convo-row">
                    <span className="convo-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isPinned && <svg viewBox="0 0 24 24" fill="var(--accent)" width="10" height="10"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
                      {c.name || c.username}
                      {c.isGroup && <span style={{ fontSize: 9, background: 'var(--gradient)', color: 'var(--accent-text)', borderRadius: 4, padding: '1px 5px', fontWeight: 700, marginLeft: 2 }}>GROUP</span>}
                    </span>
                    <span className="convo-time">{fmtTime(c.lastTime)}</span>
                  </div>
                  <span className={`convo-preview${c.unread > 0 ? ' unread' : ''}`}>{c.lastMsg}</span>
                </div>
                {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="chat-panel">
        {!activeConvo ? (
          <div className="chat-empty">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} style={{ position: 'absolute', top: 14, left: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /></svg></button>}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <p>Your messages</p>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a conversation or search for someone</span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-header">
              {/* Mobile back arrow — returns to convo list */}
              <button className="mobile-back-btn" onClick={() => { setActiveConvo(null); activeConvoRef.current = null; }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'none', alignItems: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">{sidebarOpen ? <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></> : <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /></>}</svg>
              </button>
              <div style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => { if (!activeConvo.isGroup) navigate(`/profile/${activeConvo.username}`); else setViewingGroupInfo(activeConvo); }}>
                {activeConvo.isGroup
                  ? <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent-text)' }}>
                    <svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </div>
                  : <UserAvatar src={activeConvo.avatar} name={convoName} userId={activeConvo.userId} size={38} />
                }
              </div>
              <div className="chat-header-info" style={{ flex: 1, cursor: 'pointer' }} onClick={() => { if (!activeConvo.isGroup) navigate(`/profile/${activeConvo.username}`); else setViewingGroupInfo(activeConvo); }}>
                <span className="chat-header-name">{convoName}</span>
                {!activeConvo.isGroup && <span className="chat-header-status"><span className={`online-dot${activeStatus === 'Online' ? ' online' : ''}`} style={{ width: 8, height: 8, border: 'none' }} />{activeStatus}</span>}
                {activeConvo.isGroup && <span className="chat-header-status">{(activeConvo.members?.length || 0)} members</span>}
              </div>

              {/* Call + search buttons — only for 1:1 */}
              {!activeConvo.isGroup && (
                <div style={{ display: 'flex', gap: 6, marginRight: 6 }}>
                  <button onClick={() => { if (activeConvo) startCall('audio', activeConvo); }} title="Voice call"
                    style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent-text)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-input)'; }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.39 18a19.5 19.5 0 0 1-3.39-3.39A19.79 19.79 0 0 1 2.12 6.18 2 2 0 0 1 4.11 4h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 4 4l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 20 16z" /></svg>
                  </button>
                  <button onClick={() => { if (activeConvo) startCall('video', activeConvo); }} title="Video call"
                    style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent-text)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-input)'; }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  </button>
                  {/* Search — desktop only */}
                  <button
                    className="dm-search-btn"
                    onClick={() => setDmSearchActive(true)}
                    title="Search messages"
                    style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent-text)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-input)'; }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="chat-messages">{renderMessages()}<div ref={messagesEndRef} /></div>

            {/* Reply bar */}
            {replyingTo && (
              <div className="reply-bar">
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="reply-bar-name">{replyingTo.senderName}</span>
                  <span className="reply-bar-text">{replyingTo.content?.slice(0, 80)}</span>
                </div>
                <button className="reply-bar-close" onClick={() => setReplyingTo(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* Attachment preview */}
            {attachments.length > 0 && (
              <div className="attachment-preview">
                <div className="attachment-files-row">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="attachment-file-item">
                      {att.kind === 'FILE'
                        ? <div className="att-file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
                        : att.kind === 'VIDEO'
                          ? <video src={att.dataUrl} className="att-thumb" muted />
                          : <img src={att.dataUrl} className="att-thumb" alt="preview" />
                      }
                      <span className="att-name">{att.file.name}</span>
                      <button className="att-remove" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button className="att-add-btn" onClick={() => fileInputRef.current?.click()} title="Add more files">+</button>
                </div>
                <div className="att-caption-row">
                  <textarea
                    className="att-caption-input"
                    rows={1}
                    placeholder="Add a caption…"
                    autoFocus
                    value={text}
                    onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <button className="att-send-btn" onClick={sendMessage}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* Recording bar */}
            {recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: paused ? 'var(--text-muted)' : '#ff4444', flexShrink: 0, animation: paused ? 'none' : 'rec-blink 1s ease-in-out infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: paused ? 'var(--text-muted)' : '#ff4444', minWidth: 70 }}>{paused ? 'Paused' : 'Recording…'}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>{Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')}</span>
                <button onClick={cancelRecording} style={{ marginLeft: 'auto', background: 'rgba(224,96,96,0.12)', border: '1px solid #e06060', color: '#e06060', borderRadius: 20, padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                <button onClick={pauseRecording} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  {paused ? <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5,3 19,12 5,21" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>}
                </button>
                <button onClick={sendRecording} style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            )}

            {/* Input bar */}
            {!recording && attachments.length === 0 && (
              <div className="chat-input-bar">
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt" multiple onChange={pickFile} />
                <button className="icon-btn" onClick={() => fileInputRef.current?.click()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
                {(() => {
                  const cantSend = activeConvo?.isGroup && activeConvo?.permSendMessages === false && activeConvo?.creatorId !== userId;
                  return cantSend ? (
                    <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Only admins can send messages in this group
                    </div>
                  ) : (
                    <>
                      <textarea ref={textareaRef} className="msg-textarea" rows={1}
                        placeholder={window.matchMedia('(max-width: 768px)').matches ? "Message…" : "Message… (Shift+Enter for new line)"}
                        value={text}
                        onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { setReplyingTo(null); return; }
                          const isMobile = window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
                          if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); sendMessage(); }
                        }}
                      />
                      <button className="icon-btn" onClick={startRecording} title="Voice message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg></button>
                      <button className="send-btn" onClick={sendMessage}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></button>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && <ContextMenu
        x={contextMenu.x} y={contextMenu.y} msg={contextMenu.msg} isSent={contextMenu.isSent}
        onClose={() => setContextMenu(null)}
        onReply={() => { const isSent = contextMenu.msg.senderId === userId; setReplyingTo({ id: contextMenu.msg.id, content: contextMenu.msg.content || '[attachment]', senderName: isSent ? (user?.displayName || user?.username || 'You') : (activeConvo?.name || 'Them') }); }}
        onEdit={() => { setEditingId(contextMenu.msg.id); setEditText(contextMenu.msg.content || ''); }}
        onDelete={() => deleteMessage(contextMenu.msg.id)}
        onCopy={() => copyMessage(contextMenu.msg)}
        onSelect={() => enterSelectMode(contextMenu.msg)}
      />}
      {selectMode && (
        <SelectionBar
          count={selectedIds.size}
          canDelete={[...selectedIds].every(id => { const m = messages.find(x => x.id === id); return m && m.senderId === userId; })}
          onCopy={copySelectedMessages}
          onDelete={deleteSelectedMessages}
          onCancel={cancelSelect}
        />
      )}

      {/* Call overlay */}
      {/* Group modal */}
      {showGroupModal && <GroupModal userId={userId} conversations={conversations.filter(c => !c.isGroup && c.userId !== userId)} onClose={() => setShowGroupModal(false)} onCreate={createGroup} />}

      {viewingGroupInfo && <GroupInfoPanel
        group={viewingGroupInfo}
        currentUserId={userId}
        conversations={conversations}
        messages={activeConvo?.groupId === viewingGroupInfo.groupId ? messages : []}
        onClose={() => setViewingGroupInfo(null)}
        onGroupUpdated={updated => {
          if (!updated) {
            setConversations(prev => prev.filter(c => c.groupId !== viewingGroupInfo.groupId));
            setActiveConvo(null);
            setViewingGroupInfo(null);
          } else {
            setConversations(prev => prev.map(c => c.groupId === updated.groupId ? { ...c, ...updated, name: updated.name } : c));
            if (activeConvo?.groupId === updated.groupId) setActiveConvo(prev => ({ ...prev, ...updated, name: updated.name }));
            setViewingGroupInfo(updated);
          }
        }}
        onStartCall={(callType) => {
          if (activeConvo) startCall(callType, activeConvo);
          setViewingGroupInfo(null);
        }}
        onSearchInGroup={() => {
          setDmSearchActive(true);
          setViewingGroupInfo(null);
        }}
      />}
      {myProfileOpen && <MyProfileDrawer onClose={() => setMyProfileOpen(false)} />}
      {dmSearchActive && activeConvo && (
        <DmSearchModal
          messages={messages}
          userId={userId}
          convoName={activeConvo.name || activeConvo.username}
          query={dmSearchQuery}
          onQueryChange={setDmSearchQuery}
          onClose={() => { setDmSearchActive(false); setDmSearchQuery(''); }}
        />
      )}

      {/* Right-click context menu */}
      {ctxMenu && (() => {
        const c = ctxMenu.convo;
        const isPinned = pinnedIds.includes(c.userId);
        const menuItems = [
          isPinned
            ? { label: 'Unpin', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="2" y1="2" x2="22" y2="22" /><path d="M12 17v5" /><path d="M9 9l-7 7 3 3 5-5" /><path d="M15 15l5-5-3-3-5 5" /></svg>, action: () => togglePin(c.userId) }
            : { label: 'Pin', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M12 17v5" /><path d="M9 11l-7 7 3 3 7-7" /><path d="M15 11l7-7-3-3-7 7" /><circle cx="12" cy="8" r="3" /></svg>, action: () => togglePin(c.userId) },
          { label: 'Mark as unread', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>, action: () => { } },
          ...(!c.isGroup ? [{ label: 'View profile', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>, action: () => { setCtxMenu(null); navigate(`/profile/${c.username}`); } }] : []),
          { label: 'Mute notifications', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><line x1="1" y1="1" x2="23" y2="23" /></svg>, action: () => { } },
          { label: 'Close chat', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>, action: () => { if (activeConvo?.userId === c.userId) setActiveConvo(null); }, danger: false },
          { label: 'Delete chat', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>, action: () => { if (activeConvo?.userId === c.userId) setActiveConvo(null); setConversations(prev => prev.filter(x => x.userId !== c.userId)); }, danger: true },
        ];
        // Clamp position so menu doesn't go off-screen
        const menuW = 200, menuH = menuItems.length * 38 + 8;
        const x = Math.min(ctxMenu.x, window.innerWidth - menuW - 8);
        const y = Math.min(ctxMenu.y, window.innerHeight - menuH - 8);
        return ReactDOM.createPortal(
          <>
            <div onClick={() => setCtxMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
            <div style={{
              position: 'fixed', left: x, top: y, zIndex: 9999,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '4px 0', minWidth: menuW,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}>
              {menuItems.map((item, i) => (
                <button key={i} onClick={() => { item.action(); setCtxMenu(null); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: item.danger ? '#ff4d4d' : 'var(--text-primary)',
                  fontSize: 13, fontWeight: 500, textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ opacity: item.danger ? 1 : 0.65, color: item.danger ? '#ff4d4d' : 'inherit' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        );
      })()}
    </div>
  );
}
