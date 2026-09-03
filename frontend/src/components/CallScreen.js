import React, { useState, useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import { API_BASE } from '../services/api';

function fmtDur(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
function avatarSrc(pic) {
  if (!pic) return null;
  return pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
}

/* ── Icons ── */
const PhoneOffIcon = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" width={size} height={size}>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.39 18a19.45 19.45 0 0 1-5-5 19.79 19.79 0 0 1-3.99-8.43A2 2 0 0 1 4.11 2.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 10.41" />
    <line x1="23" y1="1" x2="1" y2="23" />
  </svg>
);
const PhoneIcon = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" width={size} height={size}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.39 18a19.5 19.5 0 0 1-3.39-3.39A19.79 19.79 0 0 1 2.12 6.18 2 2 0 0 1 4.11 4h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 4 4l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 20 16z" />
  </svg>
);
const VideoIcon = ({ size = 22, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
  </svg>
);
const VideoOffIcon = ({ size = 22, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const MicIcon = ({ size = 20, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const MicOffIcon = ({ size = 20, color = '#f43f5e' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const SpeakerIcon = ({ size = 20, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);
const SpeakerOffIcon = ({ size = 20, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);
const SwapIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" width={size} height={size}>
    <path d="M7 16V4m0 0L3 8m4-4 4 4" />
    <path d="M17 8v12m0 0 4-4m-4 4-4-4" />
  </svg>
);
const MinimizeIcon = ({ size = 18, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);
const ExpandIcon = ({ size = 18, color = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

function CtrlBtn({ onClick, active, activeColor = '#f43f5e', icon, label, size = 58 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: active ? `${activeColor}28` : 'rgba(255,255,255,0.12)',
          border: `1.5px solid ${active ? activeColor : 'rgba(255,255,255,0.22)'}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: active ? activeColor : 'rgba(255,255,255,0.85)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = active ? `${activeColor}40` : 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = active ? `${activeColor}28` : 'rgba(255,255,255,0.12)'; }}
      >{icon}</button>
      {label && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500, textAlign: 'center' }}>{label}</span>}
    </div>
  );
}

function BigBtn({ onClick, bg, shadow, label, size = 68, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <button
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: bg, border: 'none', cursor: 'pointer',
          boxShadow: shadow || 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.12s, filter 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.transform = ''; }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
      >{children}</button>
      {label && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

function Dots({ label = 'Calling' }) {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN(d => d >= 3 ? 1 : d + 1), 600);
    return () => clearInterval(t);
  }, []);
  return <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 100, display: 'inline-block' }}>{label}{'.'.repeat(n)}</span>;
}

export default function CallScreen() {
  const {
    status, callType, remoteUser, ringLeft,
    muted, videoOff, reconnecting, callStartedAt,
    localStream, remoteStream, remoteTrackVersion,
    acceptCall, declineCall, endCall,
    toggleMute, toggleVideo,
  } = useCall();

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [swapped, setSwapped] = useState(false); // false = remote big, local PiP
  const [minimized, setMinimized] = useState(false);
  const timerRef = useRef(null);

  /* duration ticker */
  useEffect(() => {
    clearInterval(timerRef.current);
    if (callStartedAt) {
      setDuration(Math.floor((Date.now() - callStartedAt) / 1000));
      timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - callStartedAt) / 1000)), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [callStartedAt]);

  /* reset on idle */
  useEffect(() => {
    if (status === 'idle') { setSpeakerOn(false); setDuration(0); setSwapped(false); setMinimized(false); }
  }, [status]);

  /* ── Stream wiring ─────────────────────────────────────────────
     remoteStream is a ref getter in CallContext — it always returns
     the same MediaStream instance. We only assign srcObject when it
     has actually changed, preventing mobile video pipeline restarts.
     remoteTrackVersion increments when ontrack fires, triggering the
     effect below to re-check without passing a new object through state.
  ─────────────────────────────────────────────────────────────── */
  const setLocalVideoRef = (el) => {
    localVideoRef.current = el;
    if (el && localStream && el.srcObject !== localStream) el.srcObject = localStream;
  };
  const setRemoteVideoRef = (el) => {
    remoteVideoRef.current = el;
    const rs = remoteStream;
    if (el && rs && el.srcObject !== rs) el.srcObject = rs;
  };

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream && el.srcObject !== localStream) el.srcObject = localStream;
  }, [localStream]);

  // Fires when a new remote track arrives — re-wires srcObject only if needed.
  // remoteStream is a getter (not state), so this never triggers a re-render loop.
  useEffect(() => {
    const el = remoteVideoRef.current;
    const rs = remoteStream;
    if (el && rs && el.srcObject !== rs) el.srcObject = rs;
  }, [remoteTrackVersion]);

  if (status === 'idle') return null;

  const isIncoming = status === 'incoming';
  const isActive   = status === 'active';
  const isCalling  = status === 'calling';
  const isVideo    = callType === 'video';

  const name   = remoteUser?.name   || 'Unknown';
  const avatar = avatarSrc(remoteUser?.avatar);
  const initials = name.slice(0, 2).toUpperCase();

  const callGrad = isVideo
    ? 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
    : 'linear-gradient(160deg, #0f1923 0%, #0d2137 50%, #0a1628 100%)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9980,
      display: 'flex', flexDirection: 'column',
      background: minimized ? 'transparent' : callGrad,
      overflow: 'hidden',
      pointerEvents: minimized ? 'none' : 'auto',
    }}>
      <style>{`
        @keyframes cs-pulse {
          0%,100% { transform: scale(1);    opacity: 0.7; }
          50%      { transform: scale(1.55); opacity: 0; }
        }
        @keyframes cs-pulse2 {
          0%,100% { transform: scale(1);    opacity: 0.4; }
          50%      { transform: scale(1.9);  opacity: 0; }
        }
        @keyframes cs-breathe {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes cs-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cs-root { animation: cs-fade-in 0.28s ease both; }
      `}</style>

      {/* ── Minimized floating pill — call keeps running behind it ── */}
      {minimized && (
        <div
          onClick={() => setMinimized(false)}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 9981,
            pointerEvents: 'auto', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(15,17,23,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 999, padding: '8px 10px 8px 8px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            animation: 'cs-fade-in 0.2s ease both',
          }}
        >
          <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
            {avatar
              ? <img src={avatar} alt={name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              : <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: isVideo ? 'linear-gradient(135deg,#4facfe,#00c6ff)' : 'linear-gradient(135deg,#34d399,#10b981)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: '#fff',
                }}>{initials}</div>
            }
            {isActive && (
              <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '2px solid rgba(52,211,153,0.5)', animation: 'cs-breathe 2.2s ease-in-out infinite' }} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingRight: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ fontSize: 11.5, color: isActive ? (isVideo ? '#4facfe' : '#34d399') : 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
              {isActive && callStartedAt ? fmtDur(duration) : isIncoming ? 'Incoming…' : 'Calling…'}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); endCall(); }}
            style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(244,63,94,0.18)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="End call"
          >
            <PhoneOffIcon size={15} />
          </button>
        </div>
      )}

      {/* ── Full overlay content — hidden (not unmounted) while minimized so
           the <video> elements stay mounted and the stream never drops ── */}
      <div style={{
        display: minimized ? 'none' : 'contents',
      }}>

      {/* ── Minimize button, only while expanded and call is live ── */}
      {!minimized && (
        <button
          onClick={() => setMinimized(true)}
          style={{
            position: 'absolute', top: 20, left: 20, zIndex: 11,
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.22)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Minimize call"
        >
          <MinimizeIcon size={16} />
        </button>
      )}


      {/* ── Full-screen background video (swappable) ── */}
      {isVideo && isActive && (
        <>
          {/* BIG video — remote by default, local when swapped */}
          <video
            ref={swapped ? setLocalVideoRef : setRemoteVideoRef}
            autoPlay
            playsInline
            muted={swapped}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000', zIndex: 0 }}
          />

          {/* PiP — tap to swap */}
          {(swapped ? remoteTrackVersion > 0 : !!localStream) && (
            <div
              onClick={() => setSwapped(s => !s)}
              style={{
                position: 'absolute', top: 24, right: 20, zIndex: 10,
                cursor: 'pointer',
              }}
            >
              <video
                ref={swapped ? setRemoteVideoRef : setLocalVideoRef}
                autoPlay
                playsInline
                muted={!swapped}
                style={{
                  width: 110, height: 82, borderRadius: 14, objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.25)',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
                  display: 'block',
                }}
              />
              {/* swap icon badge */}
              <div style={{
                position: 'absolute', bottom: 6, right: 6,
                background: 'rgba(0,0,0,0.55)', borderRadius: 6,
                padding: '2px 4px', display: 'flex', alignItems: 'center',
              }}>
                <SwapIcon size={14} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Semi-transparent overlay on top of video ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: isVideo && isActive
          ? 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 35%, transparent 60%, rgba(0,0,0,0.7) 100%)'
          : 'transparent',
        pointerEvents: 'none',
      }} />

      {/* ── Main content ── */}
      <div className="cs-root" style={{
        position: 'relative', zIndex: 2,
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 24px 48px',
      }}>

        {/* ── Top: caller info ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

          {/* Avatar */}
          {(!isVideo || !isActive) && (
            <div style={{ position: 'relative', width: 110, height: 110 }}>
              {isIncoming && (<>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(52,211,153,0.6)', animation: 'cs-pulse 2s ease-out infinite' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(52,211,153,0.4)', animation: 'cs-pulse2 2s ease-out 0.7s infinite' }} />
              </>)}
              {isActive && (
                <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: '2px solid rgba(52,211,153,0.5)', animation: 'cs-breathe 2.2s ease-in-out infinite' }} />
              )}
              <div style={{ position: 'relative', zIndex: 1, width: 110, height: 110 }}>
                {avatar
                  ? <img src={avatar} alt={name} style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '3px solid rgba(255,255,255,0.15)' }} />
                  : <div style={{
                      width: 110, height: 110, borderRadius: '50%',
                      background: isVideo
                        ? 'linear-gradient(135deg,#4facfe,#00c6ff)'
                        : 'linear-gradient(135deg,#34d399,#10b981)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 38, fontWeight: 700, color: '#fff',
                      border: '3px solid rgba(255,255,255,0.15)',
                    }}>{initials}</div>
                }
              </div>
            </div>
          )}

          {/* Name */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: -0.5, marginBottom: 8 }}>{name}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>
              {reconnecting ? (
                <span style={{ color: '#f59e0b' }}>Reconnecting…</span>
              ) : isActive && callStartedAt ? (
                <span style={{ color: isVideo ? '#4facfe' : '#34d399' }}>{fmtDur(duration)}</span>
              ) : isActive ? (
                <Dots label="Connecting" />
              ) : isIncoming ? (
                <span>Incoming {isVideo ? 'video' : 'voice'} call</span>
              ) : (
                <Dots label="Calling" />
              )}
            </div>
            {isIncoming && (
              <div style={{ marginTop: 8, fontSize: 13, color: ringLeft <= 10 ? '#f43f5e' : 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
                {ringLeft}s
              </div>
            )}
          </div>
        </div>

        {/* ── PiP local video while outgoing call is connecting (not yet active) ── */}
        {isVideo && isCalling && localStream && (
          <div style={{ position: 'absolute', top: 24, right: 20, zIndex: 10 }}>
            <video
              ref={setLocalVideoRef}
              autoPlay playsInline muted
              style={{
                width: 110, height: 82, borderRadius: 14, objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.25)',
                boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* ── Bottom: controls ── */}
        <div>
          {/* Active call controls */}
          {isActive && (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 20, marginBottom: 0 }}>
              <CtrlBtn
                onClick={toggleMute}
                active={muted}
                activeColor="#f43f5e"
                label={muted ? 'Unmute' : 'Mute'}
                icon={muted ? <MicOffIcon size={20} color="#f43f5e" /> : <MicIcon size={20} />}
              />
              <CtrlBtn
                onClick={() => setSpeakerOn(s => !s)}
                active={speakerOn}
                activeColor={isVideo ? '#4facfe' : '#34d399'}
                label={speakerOn ? 'Speaker' : 'Earpiece'}
                icon={speakerOn
                  ? <SpeakerIcon size={20} color={isVideo ? '#4facfe' : '#34d399'} />
                  : <SpeakerOffIcon size={20} />}
              />
              {isVideo && (
                <CtrlBtn
                  onClick={toggleVideo}
                  active={videoOff}
                  activeColor="#f43f5e"
                  label={videoOff ? 'Start vid' : 'Stop vid'}
                  icon={videoOff
                    ? <VideoOffIcon size={20} color="#f43f5e" />
                    : <VideoIcon size={20} />}
                />
              )}
              <BigBtn
                onClick={endCall}
                bg="linear-gradient(135deg,#f43f5e,#e11d48)"
                shadow="0 8px 28px rgba(244,63,94,0.5)"
                label="End"
                size={68}
              >
                <PhoneOffIcon size={26} />
              </BigBtn>
            </div>
          )}

          {/* Outgoing — cancel only */}
          {isCalling && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <BigBtn
                onClick={endCall}
                bg="linear-gradient(135deg,#f43f5e,#e11d48)"
                shadow="0 8px 28px rgba(244,63,94,0.5)"
                label="Cancel"
              >
                <PhoneOffIcon size={26} />
              </BigBtn>
            </div>
          )}

          {/* Incoming — decline + answer */}
          {isIncoming && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 60 }}>
              <BigBtn
                onClick={declineCall}
                bg="rgba(244,63,94,0.18)"
                shadow="0 6px 24px rgba(244,63,94,0.3)"
                label="Decline"
              >
                <PhoneOffIcon size={26} />
              </BigBtn>
              <BigBtn
                onClick={acceptCall}
                bg={isVideo
                  ? 'linear-gradient(135deg,#4facfe,#00c6ff)'
                  : 'linear-gradient(135deg,#34d399,#10b981)'}
                shadow={isVideo
                  ? '0 8px 28px rgba(79,172,254,0.5)'
                  : '0 8px 28px rgba(52,211,153,0.5)'}
                label="Answer"
              >
                {isVideo ? <VideoIcon size={26} /> : <PhoneIcon size={26} />}
              </BigBtn>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
