import React, { useState, useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import { API_BASE } from '../services/api';

/* ─────────────────────────────────────────────────────────────────
   CallNotification — global full-screen call overlay.
   Works on every page. Reads all state from CallContext.
   Audio playback lives in CallContext's always-mounted <audio>.
   This component adds:
     • video stream refs + local speaker/output cycling
     • "Connecting…" dots until remoteStream has live tracks
     • duration timer that only starts after media is flowing
───────────────────────────────────────────────────────────────── */

function fmtDur(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function avatarSrc(pic) {
  if (!pic) return null;
  return pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
}

/* ── Output device cycling ────────────────────────────────────────
   Three modes that cycle on each tap:
     'earpiece'  — default (no setSinkId call needed, browser default)
     'speaker'   — setSinkId to the default output OR force via a
                   video element trick for iOS (plays audio louder)
     'bluetooth' — setSinkId to the first bluetooth audiooutput device
                   found via enumerateDevices; skipped if none found

   setSinkId is Chrome/Edge desktop + Android Chrome only.
   iOS Safari ignores it silently — we still cycle the label so the
   UI doesn't feel broken, but the actual routing won't change on iOS.
───────────────────────────────────────────────────────────────── */
async function getAudioOutputDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audiooutput');
  } catch {
    return [];
  }
}

async function applyOutputDevice(audioEl, videoEl, mode, outputDevices) {
  if (!audioEl && !videoEl) return;
  const elements = [audioEl, videoEl].filter(Boolean);

  if (mode === 'earpiece') {
    // Revert to browser default
    for (const el of elements) {
      if (typeof el.setSinkId === 'function') {
        try { await el.setSinkId(''); } catch {}
      }
    }
    return;
  }

  if (mode === 'speaker') {
    // On desktop/Android: 'default' sinkId = system default speaker.
    // On iOS this is a no-op but the volume/routing hint from autoplay
    // on a <video> element is enough to kick it to speakerphone.
    for (const el of elements) {
      if (typeof el.setSinkId === 'function') {
        try { await el.setSinkId('default'); } catch {}
      }
    }
    return;
  }

  if (mode === 'bluetooth') {
    const bt = outputDevices.find(d =>
      d.label.toLowerCase().includes('bluetooth') ||
      d.label.toLowerCase().includes('airpod') ||
      d.label.toLowerCase().includes('wireless') ||
      d.label.toLowerCase().includes('headset')
    );
    if (bt) {
      for (const el of elements) {
        if (typeof el.setSinkId === 'function') {
          try { await el.setSinkId(bt.deviceId); } catch {}
        }
      }
    }
    // If no BT device found, stay on current mode — caller handles fallback
  }
}

/* ── Icons ── */
const PhoneIcon = ({ color = '#fff', size = 22 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.39 18a19.5 19.5 0 0 1-3.39-3.39A19.79 19.79 0 0 1 2.12 6.18 2 2 0 0 1 4.11 4h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 4 4l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 20 16z" />
  </svg>
);

const PhoneOffIcon = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" width={size} height={size}>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.39 18a19.45 19.45 0 0 1-5-5 19.79 19.79 0 0 1-3.99-8.43A2 2 0 0 1 4.11 2.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 10.41" />
    <line x1="23" y1="1" x2="1" y2="23" />
  </svg>
);

const VideoIcon = ({ color = '#fff', size = 20 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </svg>
);

const VideoOffIcon = ({ color = '#fff', size = 20 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const MicIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const MicOffIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

// Speaker icons — one per output mode
const EarpieceIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

const SpeakerIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const BluetoothIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" width={size} height={size}>
    <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
  </svg>
);

/* ── Round control button ── */
function CtrlBtn({ onClick, active, activeColor = '#f43f5e', icon, label, size = 54, disabled = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: disabled ? 0.38 : 1 }}>
      <button
        onClick={disabled ? undefined : onClick}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: active ? `${activeColor}22` : 'rgba(255,255,255,0.1)',
          border: `1.5px solid ${active ? activeColor : 'rgba(255,255,255,0.18)'}`,
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: active ? activeColor : 'rgba(255,255,255,0.8)',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = active ? `${activeColor}33` : 'rgba(255,255,255,0.18)'; }}
        onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = active ? `${activeColor}22` : 'rgba(255,255,255,0.1)'; }}
      >
        {icon}
      </button>
      {label && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: 0.2, textAlign: 'center', maxWidth: 60 }}>{label}</span>}
    </div>
  );
}

/* ── Big action button (Accept / Decline / End) ── */
function ActionBtn({ onClick, bg, shadow, label, size = 64, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: bg, border: 'none',
          boxShadow: shadow || 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.12s, filter 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
      >
        {children}
      </button>
      {label && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

/* ── Animated "Connecting…" dots ── */
function ConnectingDots({ color = 'rgba(255,255,255,0.5)', label = 'Connecting' }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots(d => d >= 3 ? 1 : d + 1), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ color, fontVariantNumeric: 'tabular-nums', minWidth: 90, display: 'inline-block' }}>
      {label}{'.'.repeat(dots)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function CallNotification() {
  const {
    status, callType, remoteUser, ringLeft,
    muted, videoOff, reconnecting, callStartedAt,
    localStream, remoteStream,
    acceptCall, declineCall, endCall,
    toggleMute, toggleVideo,
  } = useCall();

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  // Output mode: 'earpiece' | 'speaker' | 'bluetooth'
  // Cycles: earpiece → speaker → bluetooth (skip BT if unavailable) → earpiece
  const [outputMode, setOutputMode]     = useState('earpiece');
  const [hasBluetooth, setHasBluetooth] = useState(false);
  const outputDevicesRef = useRef([]);


  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  const [visible, setVisible] = useState(false);
  const prevStatusRef = useRef('idle');

  /* ── Slide animation ── */
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if ((status === 'incoming' || status === 'calling') && prev === 'idle') {
      setVisible(false);
      requestAnimationFrame(() => setTimeout(() => setVisible(true), 16));
    } else if (status === 'active' && prev !== 'active') {
      setVisible(true);
    } else if (status === 'idle' && prev !== 'idle') {
      setVisible(false);
    }
  }, [status]);

  /* ── Reset per-call state when call ends ── */
  useEffect(() => {
    if (status === 'idle') {
      setOutputMode('earpiece');
      setDuration(0);
      clearInterval(timerRef.current);
    }
  }, [status]);

  /* ── Duration tick — driven purely by callStartedAt timestamp ──
     Starts the moment CallContext sets callStartedAt (ICE connected).
     Works identically on caller and callee — no dep-array race possible.
     Computes from timestamp so it's always accurate even if the tab
     was backgrounded.                                                    */
  useEffect(() => {
    clearInterval(timerRef.current);
    if (callStartedAt) {
      setDuration(Math.floor((Date.now() - callStartedAt) / 1000));
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - callStartedAt) / 1000));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [callStartedAt]);

  /* ── Probe for bluetooth output devices once on mount ── */
  useEffect(() => {
    getAudioOutputDevices().then(devices => {
      outputDevicesRef.current = devices;
      const hasBT = devices.some(d =>
        d.label.toLowerCase().includes('bluetooth') ||
        d.label.toLowerCase().includes('airpod') ||
        d.label.toLowerCase().includes('wireless') ||
        d.label.toLowerCase().includes('headset')
      );
      setHasBluetooth(hasBT);
    });
  }, []);

  /* ── Local video stream ── */
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  /* ── Remote video stream attachment ──
     remoteStream is the same MediaStream object reference throughout a call,
     so we only need this effect to wire up the video element srcObject.    */
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);



  /* ── Output device cycling ── */
  async function cycleOutput() {
    const ORDER = hasBluetooth
      ? ['earpiece', 'speaker', 'bluetooth']
      : ['earpiece', 'speaker'];
    const next = ORDER[(ORDER.indexOf(outputMode) + 1) % ORDER.length];

    // If jumping to bluetooth and no device found, skip back to earpiece
    if (next === 'bluetooth') {
      const devices = await getAudioOutputDevices();
      outputDevicesRef.current = devices;
      const bt = devices.find(d =>
        d.label.toLowerCase().includes('bluetooth') ||
        d.label.toLowerCase().includes('airpod') ||
        d.label.toLowerCase().includes('wireless') ||
        d.label.toLowerCase().includes('headset')
      );
      if (!bt) { setOutputMode('earpiece'); await applyOutputDevice(null, remoteVideoRef.current, 'earpiece', devices); return; }
    }

    setOutputMode(next);
    await applyOutputDevice(null, remoteVideoRef.current, next, outputDevicesRef.current);
  }

  if (status === 'idle') return null;

  const isIncoming = status === 'incoming';
  const isActive   = status === 'active';
  const isCalling  = status === 'calling';
  const isVideo    = callType === 'video';
  const accentColor = isVideo ? '#4facfe' : '#34d399';

  const name   = remoteUser?.name   || 'Unknown';
  const avatar = avatarSrc(remoteUser?.avatar);

  // Output button config
  const outputConfig = {
    earpiece:  { icon: <EarpieceIcon size={18} color="rgba(255,255,255,0.8)" />, label: 'Earpiece' },
    speaker:   { icon: <SpeakerIcon  size={18} color={accentColor}            />, label: 'Speaker'  },
    bluetooth: { icon: <BluetoothIcon size={18} color="#818cf8"               />, label: 'Bluetooth' },
  }[outputMode];

  return (
    <>
      <style>{`
        @keyframes cn-slide-down {
          from { transform: translateX(-50%) translateY(-108%); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
        }
        @keyframes cn-slide-up {
          from { transform: translateX(-50%) translateY(0);     opacity: 1; }
          to   { transform: translateX(-50%) translateY(-108%); opacity: 0; }
        }
        @keyframes cn-pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(1);    opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(1.75); opacity: 0;   }
        }
        @keyframes cn-pulse-ring2 {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.4; }
          100% { transform: translate(-50%,-50%) scale(2.1); opacity: 0;   }
        }
        @keyframes cn-breathe {
          0%,100% { box-shadow: 0 0 0 0 rgba(79,172,254,0.45); }
          50%      { box-shadow: 0 0 0 10px transparent; }
        }
        .cn-overlay {
          animation: ${visible
            ? 'cn-slide-down 0.34s cubic-bezier(0.25,0.46,0.45,0.94) forwards'
            : 'cn-slide-up   0.26s cubic-bezier(0.55,0,1,0.45)        forwards'};
        }
      `}</style>

      {/* Full-screen remote video for active video calls */}
      {isVideo && isActive && remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            width: '100%', height: '100%', objectFit: 'cover',
            background: '#000',
          }}
        />
      )}

      {/* PiP local video */}
      {isVideo && (isActive || isCalling) && localStream && (
        <video
          ref={localVideoRef}
          autoPlay playsInline muted
          style={{
            position: 'fixed', bottom: 100, right: 20,
            width: 120, height: 90, borderRadius: 12,
            objectFit: 'cover',
            border: '2px solid rgba(255,255,255,0.3)',
            zIndex: 9992,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        />
      )}

      {/* Floating card */}
      <div style={{
        position: 'fixed', top: 16, left: '50%',
        zIndex: 9999,
        width: 'min(380px, calc(100vw - 20px))',
        pointerEvents: 'none',
      }}>
        <div
          className="cn-overlay"
          style={{
            pointerEvents: 'auto',
            background: isVideo && isActive ? 'rgba(0,0,0,0.55)' : 'rgba(10,12,18,0.97)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Accent bar */}
          <div style={{
            height: 3,
            background: isVideo
              ? 'linear-gradient(90deg,#4facfe,#00c6ff)'
              : 'linear-gradient(90deg,#34d399,#10b981)',
          }} />

          {/* Body */}
          <div style={{ padding: '18px 20px 20px' }}>

            {/* Avatar + name + status line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>

              {/* Avatar with rings */}
              <div style={{ position: 'relative', flexShrink: 0, width: 56, height: 56 }}>
                {isIncoming && (<>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 56, height: 56, borderRadius: '50%',
                    border: `2px solid ${accentColor}`,
                    animation: 'cn-pulse-ring 1.8s ease-out infinite',
                    pointerEvents: 'none',
                  }} />
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 56, height: 56, borderRadius: '50%',
                    border: `2px solid ${accentColor}`,
                    animation: 'cn-pulse-ring2 1.8s ease-out 0.6s infinite',
                    pointerEvents: 'none',
                  }} />
                </>)}
                {(isActive || isCalling) && (
                  <div style={{
                    position: 'absolute', inset: -4, borderRadius: '50%',
                    border: `2px solid ${accentColor}`,
                    animation: 'cn-breathe 2s ease-in-out infinite',
                  }} />
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  {avatar
                    ? <img src={avatar} alt={name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: `linear-gradient(135deg,${accentColor},${isVideo ? '#00c6ff' : '#10b981'})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, fontWeight: 700, color: '#fff',
                      }}>{name.slice(0, 2).toUpperCase()}</div>
                  }
                </div>
              </div>

              {/* Name + status */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 17, fontWeight: 700, color: '#f0f0f0',
                  letterSpacing: -0.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {name}
                </div>
                <div style={{
                  fontSize: 12, marginTop: 3,
                  fontVariantNumeric: 'tabular-nums',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {reconnecting ? (
                    <span style={{ color: '#f59e0b' }}>Reconnecting…</span>
                  ) : isActive && callStartedAt ? (
                    <span style={{ color: accentColor }}>{fmtDur(duration)}</span>
                  ) : isActive && !callStartedAt ? (
                    <ConnectingDots color="rgba(255,255,255,0.45)" label="Connecting" />
                  ) : isIncoming ? (
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Incoming {isVideo ? 'video' : 'voice'} call…
                    </span>
                  ) : (
                    <ConnectingDots color="rgba(255,255,255,0.45)" label="Calling" />
                  )}

                  {isIncoming && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: ringLeft <= 10 ? '#f43f5e' : 'rgba(255,255,255,0.3)',
                    }}>
                      {ringLeft}s
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── INCOMING ── */}
            {isIncoming && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 48 }}>
                <ActionBtn
                  onClick={declineCall}
                  bg="rgba(244,63,94,0.16)"
                  shadow="0 4px 20px rgba(244,63,94,0.3)"
                  label="Decline"
                >
                  <PhoneOffIcon size={24} />
                </ActionBtn>
                <ActionBtn
                  onClick={acceptCall}
                  bg={isVideo ? 'linear-gradient(135deg,#4facfe,#00c6ff)' : 'linear-gradient(135deg,#34d399,#10b981)'}
                  shadow={isVideo ? '0 6px 24px rgba(79,172,254,0.5)' : '0 6px 24px rgba(52,211,153,0.5)'}
                  label="Answer"
                >
                  {isVideo ? <VideoIcon color="#fff" size={24} /> : <PhoneIcon color="#fff" size={24} />}
                </ActionBtn>
              </div>
            )}

            {/* ── CALLING (outgoing) ── */}
            {isCalling && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ActionBtn
                  onClick={endCall}
                  bg="linear-gradient(135deg,#f43f5e,#e11d48)"
                  shadow="0 6px 20px rgba(244,63,94,0.5)"
                  label="Cancel"
                >
                  <PhoneOffIcon size={24} />
                </ActionBtn>
              </div>
            )}

            {/* ── ACTIVE ── */}
            {isActive && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 14 }}>

                {/* Mute */}
                <CtrlBtn
                  onClick={toggleMute}
                  active={muted}
                  activeColor="#f43f5e"
                  label={muted ? 'Unmute' : 'Mute'}
                  icon={muted
                    ? <MicOffIcon size={18} color="#f43f5e" />
                    : <MicIcon    size={18} color="rgba(255,255,255,0.8)" />
                  }
                />

                {/* Output device cycle — earpiece / speaker / bluetooth */}
                <CtrlBtn
                  onClick={cycleOutput}
                  active={outputMode !== 'earpiece'}
                  activeColor={outputMode === 'bluetooth' ? '#818cf8' : accentColor}
                  label={outputConfig.label}
                  icon={outputConfig.icon}
                />

                {/* Video toggle — only on video calls */}
                {isVideo && (
                  <CtrlBtn
                    onClick={toggleVideo}
                    active={videoOff}
                    activeColor="#f43f5e"
                    label={videoOff ? 'Start vid' : 'Stop vid'}
                    icon={videoOff
                      ? <VideoOffIcon color="#f43f5e"              size={18} />
                      : <VideoIcon    color="rgba(255,255,255,0.8)" size={18} />
                    }
                  />
                )}

                {/* End call */}
                <ActionBtn
                  onClick={endCall}
                  bg="linear-gradient(135deg,#f43f5e,#e11d48)"
                  shadow="0 6px 20px rgba(244,63,94,0.5)"
                  label="End call"
                  size={54}
                >
                  <PhoneOffIcon size={22} />
                </ActionBtn>

              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}