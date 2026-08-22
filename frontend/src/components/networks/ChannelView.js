import React, { useEffect, useRef, useState, useCallback } from 'react';
import { networkApi, resolveUrl } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import UserAvatar from '../UserAvatar';
import NetworkUserPopover from './NetworkUserPopover';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

function fmtDur(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const TYPE_LABEL = { TEXT: '', VOICE: '(voice)', ANNOUNCEMENT: '(announcements)' };

// Cycle order for the playback-speed button on a voice note.
const SPEED_STEPS = [1, 1.25, 1.5, 2, 0.5, 0.75];
const WAVE_BAR_COUNT = 32;

// Deterministic per-message placeholder so different voice notes at least
// don't all render the exact same static pattern while the real waveform
// is being computed (or if decoding fails, e.g. a storage host without
// CORS enabled for fetch). Not audio-derived — just a stable fallback.
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

// Real per-message waveform: fetch the actual audio, decode it, and take
// the peak amplitude of each of WAVE_BAR_COUNT time slices — this is what
// makes the bars reflect the actual recording (loud parts tall, silence
// short) instead of a generic decorative shape. Cached per src so a
// message re-rendering (or appearing twice in the list briefly) doesn't
// redecode the same audio.
const waveformCache = new Map(); // src -> Promise<number[] | null>
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
      return null; // caller keeps its seeded fallback
    }
  })();
  waveformCache.set(src, promise);
  return promise;
}

// Voice note playback bubble — play/pause, a real waveform derived from
// the actual recording, a playback-speed button, and a pitch-sync toggle
// next to it. When sync is on, pitch moves with speed — faster sounds
// chipmunky, slower sounds monstrous, like an old tape running at the
// wrong speed. Toggled off, speed changes but pitch stays put (browser's
// default pitch correction).
function ChannelVoiceBubble({ src, durationHint = 0 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [pitchSynced, setPitchSynced] = useState(true);
  const [peaks, setPeaks] = useState(() => seededPeaks(hashString(src), WAVE_BAR_COUNT));
  const total = WAVE_BAR_COUNT;

  // Swap in the real, audio-derived waveform once it's decoded. Falls back
  // to the seeded placeholder (set above and reset here on src change) if
  // decoding fails — e.g. the storage host doesn't send CORS headers for a
  // plain fetch, in which case <audio> playback still works fine but we
  // can't read the raw samples to draw an accurate waveform.
  useEffect(() => {
    let cancelled = false;
    setPeaks(seededPeaks(hashString(src), WAVE_BAR_COUNT));
    computeWaveform(src).then(real => {
      if (!cancelled && real) setPeaks(real);
    });
    return () => { cancelled = true; };
  }, [src]);

  function trySetDur(d) { if (d && isFinite(d) && d > 0) setDuration(d); }

  function applyAudioSettings(a, idx = speedIdx, synced = pitchSynced) {
    if (!a) return;
    a.playbackRate = SPEED_STEPS[idx];
    // preservesPitch=false lets pitch shift with playbackRate (chipmunk/
    // beast effect); true keeps pitch level regardless of speed.
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
      if (!(duration > 0) && a.readyState < 1) a.load();
      applyAudioSettings(a);
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else { a.pause(); setPlaying(false); }
  }

  function cycleSpeed(e) {
    e.stopPropagation();
    setSpeedIdx(i => (i + 1) % SPEED_STEPS.length);
  }

  function togglePitchSync(e) {
    e.stopPropagation();
    setPitchSynced(s => !s);
  }

  const displayDur = duration > 0 ? duration : (durationHint > 0 ? durationHint : null);
  const played = displayDur && displayDur > 0 ? Math.round((current / displayDur) * total) : 0;
  const durLabel = playing ? fmtDur(current) : (displayDur ? fmtDur(displayDur) : null);
  const speed = SPEED_STEPS[speedIdx];
  const speedLabel = `${speed}x`;
  const barHeights = peaks.map(p => Math.round(4 + p * 20)); // 4px..24px

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
      borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)',
      width: 300, maxWidth: '100%',
    }}>
      <button
        onClick={toggle}
        style={{
          width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer',
        }}
      >
        {playing
          ? <svg viewBox="0 0 24 24" fill="#fff" width="12" height="12"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          : <svg viewBox="0 0 24 24" fill="#fff" width="12" height="12" style={{ marginLeft: 1 }}><polygon points="5,3 19,12 5,21" /></svg>}
      </button>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={e => trySetDur(e.target.duration)}
        onDurationChange={e => trySetDur(e.target.duration)}
        onTimeUpdate={e => { setCurrent(e.target.currentTime); trySetDur(e.target.duration); }}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 24, width: '100%', justifyContent: 'space-between' }}>
          {barHeights.map((h, i) => (
            <span
              key={i}
              style={{
                width: 2.5, height: h, borderRadius: 1, flexShrink: 0,
                background: i < played ? 'var(--accent)' : 'var(--border-input)',
              }}
            />
          ))}
        </div>
        {durLabel && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>{durLabel}</div>}
      </div>

      <button
        onClick={cycleSpeed}
        title="Playback speed — click to change"
        style={{
          border: 'none', background: 'var(--bg-hover)', color: 'var(--text-secondary)',
          borderRadius: 6, padding: '4px 8px', fontSize: 11.5, fontWeight: 600, flexShrink: 0, cursor: 'pointer',
        }}
      >
        {speedLabel}
      </button>

      <button
        onClick={togglePitchSync}
        title={pitchSynced ? 'Pitch synced to speed (chipmunk/beast) — click to keep pitch normal' : 'Pitch stays normal — click to sync pitch with speed'}
        style={{
          border: 'none', borderRadius: 6, width: 26, height: 26, padding: 0, flexShrink: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: pitchSynced ? 'var(--accent-glow)' : 'var(--bg-hover)',
          color: pitchSynced ? 'var(--accent)' : 'var(--text-muted)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h3l2 5 4-16 3 11 2-5h4" />
        </svg>
      </button>
    </div>
  );
}

export default function ChannelView({ networkId, channel, currentUserId, hideHeader = false }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [hasMore, setHasMore]   = useState(false);
  const [page, setPage]         = useState(0);
  const [draft, setDraft]       = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [popover, setPopover]   = useState(null); // { userId, anchor, roleColor }
  const [replyTarget, setReplyTarget] = useState(null); // the message object being replied to, or null
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteModalTarget, setDeleteModalTarget] = useState(null); // message pending delete confirmation
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const listRef = useRef(null);
  const messageRefs = useRef({}); // id -> DOM node, so clicking a quoted preview can scroll to the original
  const recorderRef = useRef(null);
  const recTimerRef = useRef(null);

  function scrollToMessage(id) {
    const node = messageRefs.current[id];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.style.transition = 'background-color 0.2s';
    node.style.backgroundColor = 'var(--bg-hover, rgba(255,255,255,0.06))';
    setTimeout(() => { node.style.backgroundColor = ''; }, 900);
  }

  const load = useCallback(async (pageToLoad) => {
    if (!channel) return;
    try {
      const result = await networkApi.getChannelMessages(networkId, channel.id, pageToLoad, 50);
      const items = (result.content || []).slice().reverse(); // API returns newest-first; render oldest-first
      setMessages(prev => pageToLoad === 0 ? items : [...items, ...prev]);
      setHasMore(!result.last);
      setPage(pageToLoad);
    } catch (e) {
      setError(e.message || 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [networkId, channel]);

  useEffect(() => {
    setMessages([]); setLoading(true); setError(''); setReplyTarget(null);
    load(0);
  }, [channel?.id]);

  // Live updates — without this, messages from other members only ever
  // showed up on a full reload, since this view previously had zero
  // WebSocket subscription and relied entirely on the initial REST fetch.
  const handleWsMessage = useCallback((msg) => {
    if (!msg || msg.channelId == null || !channel || Number(msg.channelId) !== Number(channel.id)) return;

    if (msg.wsEvent === 'MESSAGE_DELETED') {
      setMessages(prev => prev
        .filter(m => m.id !== msg.id) // drop the deleted message itself
        .map(m => m.parentId === msg.id
          // Live-patch any reply pointing at it, without waiting for a
          // reload — same fields ChannelService sets server-side when it
          // resolves a REPLY whose parent lookup comes back empty.
          ? { ...m, parentDeleted: true, parentAuthorId: null, parentAuthorUsername: null, parentAuthorDisplayName: null, parentAuthorAvatar: null, parentContent: null }
          : m));
      return;
    }

    setMessages(prev => {
      // Already-known message (or an edit to one) — update in place rather
      // than appending a duplicate. Edits reuse the same message id.
      const existingIdx = prev.findIndex(m => m.id === msg.id);
      if (existingIdx !== -1) {
        return prev.map((m, i) => i === existingIdx ? msg : m);
      }
      // This is our own message coming back over the socket — it may well
      // arrive before the REST response does, so replace the optimistic
      // placeholder instead of appending a second copy of it.
      if (msg.authorId === currentUserId) {
        const idx = prev.findIndex(m => m._optimistic && m.content === msg.content);
        if (idx !== -1) {
          return prev.map((m, i) => i === idx ? msg : m);
        }
      }
      return [...prev, msg];
    });
  }, [channel?.id, currentUserId]);

  const { subscribeToChannel } = useWebSocket(currentUserId, handleWsMessage);
  useEffect(() => {
    if (channel?.id) subscribeToChannel(channel.id);
  }, [channel?.id, subscribeToChannel]);

  useEffect(() => {
    if (page === 0 && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, page]);

  // Stop any in-flight recording if the user switches channels mid-recording.
  // Kept above the early returns below so hook order stays consistent
  // across renders regardless of channel type (Rules of Hooks).
  useEffect(() => {
    return () => {
      clearInterval(recTimerRef.current);
      const mr = recorderRef.current;
      if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
        mr._cancelled = true;
        mr.stop();
      }
    };
  }, [channel?.id]);

  if (!channel) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Pick a channel to get started.
      </div>
    );
  }

  if (channel.type === 'VOICE') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="34" height="34"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        <div style={{ fontSize: 13 }}>Voice channels aren't wired up yet — coming in a later pass.</div>
      </div>
    );
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true); setError('');
    const tmpId = `tmp-${Date.now()}`;
    const replyingTo = replyTarget;
    setMessages(prev => [...prev, {
      id: tmpId, content, authorId: currentUserId, createdAt: new Date().toISOString(), _optimistic: true,
      parentId: replyingTo?.id ?? null,
      parentAuthorUsername: replyingTo?.authorUsername ?? null,
      parentAuthorDisplayName: replyingTo?.authorDisplayName ?? null,
      parentContent: replyingTo?.content ?? null,
    }]);
    setDraft('');
    setReplyTarget(null);
    try {
      const saved = await networkApi.postChannelMessage(networkId, channel.id, content, undefined, replyingTo?.id);
      setMessages(prev => prev.map(m => m.id === tmpId ? saved : m));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      setError(e.message || 'Failed to send — permission denied, or announcement channels need POST_IN_ANNOUNCEMENTS.');
      setDraft(content);
      setReplyTarget(replyingTo);
    } finally {
      setSending(false);
    }
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
      const replyingTo = replyTarget;
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const capturedDuration = mr._durationSnapshot;
        setRecording(false); setPaused(false); setRecSeconds(0); clearInterval(recTimerRef.current);
        if (!mr._cancelled && chunks.length) {
          const blob = new Blob(chunks, { type: mime });
          if (blob.size > 1000) {
            const fd = new FormData();
            fd.append('file', new File([blob], `voice_${Date.now()}.webm`, { type: mime }));
            fd.append('durationSeconds', String(capturedDuration || 0));
            if (replyingTo) fd.append('parentId', replyingTo.id);
            try {
              const saved = await networkApi.uploadChannelVoiceMessage(networkId, channel.id, fd);
              // The channel's WS subscription may well deliver this same
              // message first — dedupe by id rather than append blindly.
              setMessages(prev => prev.some(m => m.id === saved.id) ? prev : [...prev, saved]);
              setReplyTarget(null);
            } catch (e) {
              setError(e.message || 'Failed to send voice note.');
            }
          }
        }
      };
      mr.start(100); recorderRef.current = mr; setRecording(true); setPaused(false);
      let s = 0;
      recTimerRef.current = setInterval(() => { s++; setRecSeconds(s); mr._durationSnapshot = s; if (s >= 300) sendRecording(); }, 1000);
    } catch (err) {
      console.error('Mic error:', err);
      setRecording(false);
      setError('Could not access microphone.');
    }
  }

  function pauseRecording() {
    const mr = recorderRef.current; if (!mr) return;
    if (mr.state === 'recording') { mr.pause(); setPaused(true); clearInterval(recTimerRef.current); }
    else if (mr.state === 'paused') {
      mr.resume(); setPaused(false);
      let s = recSeconds;
      recTimerRef.current = setInterval(() => { s++; setRecSeconds(s); mr._durationSnapshot = s; if (s >= 300) sendRecording(); }, 1000);
    }
  }

  function sendRecording() {
    clearInterval(recTimerRef.current);
    const mr = recorderRef.current;
    if (!mr || (mr.state !== 'recording' && mr.state !== 'paused')) return;
    mr.stop();
  }

  function cancelRecording() {
    clearInterval(recTimerRef.current);
    const mr = recorderRef.current;
    if (!mr) return;
    mr._cancelled = true;
    if (mr.state === 'recording' || mr.state === 'paused') mr.stop();
    else { setRecording(false); setPaused(false); setRecSeconds(0); }
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditDraft(m.content || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft('');
  }

  async function saveEdit(m) {
    const content = editDraft.trim();
    if (!content) return;
    if (content === m.content) { cancelEdit(); return; }
    try {
      const updated = await networkApi.editChannelMessage(networkId, channel.id, m.id, content);
      setMessages(prev => prev.map(x => x.id === m.id ? updated : x));
    } catch (e) {
      setError(e.message || 'Failed to edit message.');
    } finally {
      cancelEdit();
    }
  }

  async function performDelete(m) {
    // No WS broadcast on delete (see ChannelController), so this only
    // reflects for the deleter unless everyone happens to reload — fine
    // for now, matches the current backend contract.
    try {
      await networkApi.deleteChannelMessage(networkId, channel.id, m.id);
      setMessages(prev => prev.filter(x => x.id !== m.id));
    } catch (e) {
      setError(e.message || 'Failed to delete message.');
    }
  }

  function handleDeleteClick(m, e) {
    if (e?.shiftKey) {
      performDelete(m); // hold shift to skip the confirmation, same as Discord
    } else {
      setDeleteModalTarget(m);
    }
  }

  function copyText(m) {
    navigator.clipboard?.writeText(m.content || '');
  }

  const toolbarBtnStyle = {
    background: 'none', border: 'none', borderRadius: 5,
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--text-muted)',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-primary)' }}>
      <style>{`
        .channel-message-row:hover { background: var(--bg-hover, rgba(255,255,255,0.03)); }
        .channel-message-row:hover .channel-message-toolbar { opacity: 1 !important; }
        .channel-toolbar-btn:hover { background: var(--bg-hover, rgba(255,255,255,0.08)); color: var(--text-primary); }
        .channel-toolbar-btn-danger:hover { background: rgba(224,96,96,0.15); color: #e06060; }
      `}</style>
      {!hideHeader && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-primary)',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>#</span>
          {channel.name}
          {TYPE_LABEL[channel.type] && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{TYPE_LABEL[channel.type]}</span>}
        </div>
      )}

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Loading…</div>}

        {!loading && hasMore && (
          <button
            onClick={() => load(page + 1)}
            style={{ alignSelf: 'center', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            Load earlier messages
          </button>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
            No messages yet — say something.
          </div>
        )}

        {messages.map(m => {
          const pingsMe = currentUserId != null && (
            (m.parentAuthorId != null && Number(m.parentAuthorId) === Number(currentUserId)) ||
            (Array.isArray(m.mentionedUserIds) && m.mentionedUserIds.map(Number).includes(Number(currentUserId)))
          );
          return (
          <div
            key={m.id}
            ref={el => { if (el) messageRefs.current[m.id] = el; else delete messageRefs.current[m.id]; }}
            className="channel-message-row"
            style={{
              opacity: m._optimistic ? 0.6 : 1, padding: '6px 10px 6px 8px', borderRadius: 6, position: 'relative',
              background: pingsMe ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
              borderLeft: pingsMe ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {m.parentId != null && (
              <div
                onClick={m.parentDeleted ? undefined : () => scrollToMessage(m.parentId)}
                style={{
                  display: 'flex', alignItems: 'center', marginLeft: 16, marginBottom: 2,
                  fontSize: 12, color: 'var(--text-muted)', cursor: m.parentDeleted ? 'default' : 'pointer', maxWidth: 460,
                }}
              >
                {/* Discord-style curved connector: drops from above, curves right into the quoted line */}
                <svg width="26" height="14" viewBox="0 0 26 14" style={{ flexShrink: 0, overflow: 'visible' }}>
                  <path d="M 6 0 V 6 C 6 10 9 10 13 10 H 22" fill="none" stroke={m.parentDeleted ? 'var(--text-muted)' : 'var(--accent)'} strokeWidth="2" strokeLinecap="round" />
                </svg>
                {m.parentDeleted ? (
                  <span style={{ fontStyle: 'italic', opacity: 0.75 }}>Original message was deleted</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <UserAvatar
                      src={m.parentAuthorAvatar}
                      name={m.parentAuthorDisplayName || m.parentAuthorUsername}
                      size={16}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {m.parentAuthorDisplayName || m.parentAuthorUsername || 'someone'}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {m.parentContent || ''}
                    </span>
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <UserAvatar
                src={m.authorAvatar}
                name={m.authorDisplayName || m.authorUsername}
                size={32}
                onClick={m.authorId ? (e => setPopover({ userId: m.authorId, anchor: e.currentTarget, roleColor: m.authorRoleColor })) : undefined}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  <span
                    onClick={m.authorId ? (e => setPopover({ userId: m.authorId, anchor: e.currentTarget, roleColor: m.authorRoleColor })) : undefined}
                    style={{ color: m.authorRoleColor || 'var(--text-primary)', cursor: m.authorId ? 'pointer' : 'default', fontWeight: 600 }}
                  >
                    {m.authorDisplayName || m.authorUsername || 'you'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{formatTime(m.createdAt)}</span>
                  {m.edited && <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>(edited)</span>}
                </div>
                {editingId === m.id ? (
                  <div style={{ marginTop: 3 }}>
                    <input
                      className="auth-input"
                      autoFocus
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(m); }
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      style={{ fontSize: 13.5, padding: '5px 8px' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      escape to <span onClick={cancelEdit} style={{ cursor: 'pointer', color: 'var(--accent)' }}>cancel</span> · enter to <span onClick={() => saveEdit(m)} style={{ cursor: 'pointer', color: 'var(--accent)' }}>save</span>
                    </div>
                  </div>
                ) : m.mediaType === 'VOICE' ? (
                  <div style={{ marginTop: 4 }}>
                    <ChannelVoiceBubble
                      src={resolveUrl(m.fileUrl)}
                      durationHint={m.durationSeconds ? Number(m.durationSeconds) : 0}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.content}
                  </div>
                )}
              </div>
            </div>

            {!m._optimistic && editingId !== m.id && (
              <div
                className="channel-message-toolbar"
                style={{
                  position: 'absolute', top: -6, right: 8, zIndex: 5,
                  display: 'flex', alignItems: 'center', gap: 1, opacity: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <button
                  onClick={() => setReplyTarget(m)}
                  title="Reply"
                  className="channel-toolbar-btn"
                  style={toolbarBtnStyle}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M9 17 4 12l5-5" /><path d="M4 12h11a4 4 0 0 0 4-4V7" />
                  </svg>
                </button>

                {m.authorId === currentUserId && (
                  <button onClick={() => startEdit(m)} title="Edit" className="channel-toolbar-btn" style={toolbarBtnStyle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                )}

                <button onClick={() => copyText(m)} title="Copy text" className="channel-toolbar-btn" style={toolbarBtnStyle}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>

                {m.authorId === currentUserId && (
                  <button
                    onClick={(e) => handleDeleteClick(m, e)}
                    title="Delete"
                    className="channel-toolbar-btn channel-toolbar-btn-danger"
                    style={toolbarBtnStyle}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {popover && (
        <NetworkUserPopover
          anchorRef={{ current: popover.anchor }}
          networkId={networkId}
          userId={popover.userId}
          roleColor={popover.roleColor}
          onClose={() => setPopover(null)}
        />
      )}

      {deleteModalTarget && (
        <div
          onClick={() => setDeleteModalTarget(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
              width: 440, maxWidth: '90vw', padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Delete Message</div>
              <button
                onClick={() => setDeleteModalTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Are you sure you want to delete this message?
            </div>

            <div style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 14 }}>
              <UserAvatar
                src={deleteModalTarget.authorAvatar}
                name={deleteModalTarget.authorDisplayName || deleteModalTarget.authorUsername}
                size={32}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  <span style={{ fontWeight: 600 }}>{deleteModalTarget.authorDisplayName || deleteModalTarget.authorUsername || 'you'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{formatTime(deleteModalTarget.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {deleteModalTarget.content}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>PROTIP: </span>
              You can hold down shift when clicking delete to bypass this confirmation entirely.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setDeleteModalTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13.5, padding: '8px 14px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { performDelete(deleteModalTarget); setDeleteModalTarget(null); }}
                style={{ background: '#e06060', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, borderRadius: 6, padding: '8px 16px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ margin: '0 14px 8px', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>
          {error}
        </div>
      )}

      {replyTarget && (
        <div style={{
          margin: '0 10px', padding: '6px 10px', borderRadius: '8px 8px 0 0',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderBottom: 'none',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" width="12" height="12" style={{ flexShrink: 0, transform: 'scaleX(-1)' }}>
            <path d="M9 17 4 12l5-5" /><path d="M4 12h11a4 4 0 0 0 4-4V7" />
          </svg>
          <span>
            Replying to <strong style={{ color: 'var(--accent)' }}>{replyTarget.authorDisplayName || replyTarget.authorUsername || 'someone'}</strong>
          </span>
          <button
            onClick={() => setReplyTarget(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      {recording ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: paused ? 'var(--text-muted)' : '#ff4444', flexShrink: 0, animation: paused ? 'none' : 'rec-blink 1s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: paused ? 'var(--text-muted)' : '#ff4444', minWidth: 70 }}>{paused ? 'Paused' : 'Recording…'}</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>
            {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')}
          </span>
          <button
            onClick={cancelRecording}
            style={{ marginLeft: 'auto', background: 'rgba(224,96,96,0.12)', border: '1px solid #e06060', color: '#e06060', borderRadius: 20, padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={pauseRecording}
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            {paused
              ? <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><polygon points="5,3 19,12 5,21" /></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>}
          </button>
          <button
            onClick={sendRecording}
            style={{ background: 'var(--accent)', border: 'none', color: 'var(--accent-text)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
      ) : (
        <div className="channel-input-bar" style={{ paddingTop: 10, paddingLeft: 10, paddingRight: 10, borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            className="auth-input"
            style={{ flex: 1 }}
            placeholder={channel.type === 'ANNOUNCEMENT' ? `Announce in #${channel.name}` : `Message #${channel.name}`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={sending}
          />
          <button
            className="icon-btn"
            onClick={startRecording}
            title="Voice message"
            style={{ flexShrink: 0 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
