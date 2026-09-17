import React, { useEffect, useRef } from 'react';
import { useGroupCall } from '../context/GroupCallContext';

// Web counterpart to mobile's GroupCallOverlay.js. Self-contained inline
// styles rather than global.css classes, same reasoning CallScreen.js
// likely doesn't share — a call UI's exact look isn't something themes
// should reach into, and this avoids a large CSS diff for one component.

function VideoTile({ stream, label, isLocal, isVideo, muted }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={styles.tile}>
      {isVideo && stream ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} style={styles.tileVideo} />
      ) : (
        <div style={styles.tileAvatar}>{(label || '?').slice(0, 1).toUpperCase()}</div>
      )}
      <div style={styles.tileLabel}>{label}{muted ? ' 🔇' : ''}</div>
    </div>
  );
}

export default function GroupCallOverlay() {
  const {
    status, callType, inviter, ringLeft, localStream, participants,
    muted, videoOff, roomFullError, acceptGroupCall, declineGroupCall, leaveGroupCall,
    ringGroup, toggleMute, toggleVideo,
  } = useGroupCall();

  const roomFullToast = roomFullError && (
    <div style={styles.roomFullToast}>
      Call is full ({roomFullError.maxSize}/{roomFullError.maxSize}) — mesh calls cap out here without a media server
    </div>
  );

  if (status === 'idle') return roomFullToast;

  const isVideo = callType === 'video';
  const accent = isVideo ? '#4facfe' : '#34d399';

  if (status === 'ringing') {
    return (
      <div style={styles.ringWrap}>
        <div style={styles.ringCard}>
          <div style={{ ...styles.accentBar, background: accent }} />
          <div style={styles.ringBody}>
            <div style={styles.ringHeaderRow}>
              <div style={styles.avatarCircle}>{(inviter?.name || '?').slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.name}>{inviter?.name || 'Someone'}</div>
                <div style={styles.statusText}>is starting a group {isVideo ? 'video' : 'voice'} call…</div>
              </div>
              <div style={{ ...styles.ringLeft, color: ringLeft <= 10 ? '#f43f5e' : 'rgba(255,255,255,0.3)' }}>{ringLeft}s</div>
            </div>
            <div style={styles.row}>
              <button style={{ ...styles.actionBtn, background: 'rgba(244,63,94,0.16)' }} onClick={declineGroupCall}>
                <PhoneOffSvg color="#f43f5e" />
              </button>
              <button style={{ ...styles.actionBtn, background: accent }} onClick={acceptGroupCall}>
                <PhoneSvg />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // status === 'active'
  const tiles = [{ userId: 'local', isLocal: true, stream: localStream, label: 'You' }, ...Array.from(participants.values()).map(p => ({
    userId: p.userId, isLocal: false, stream: p.stream, label: p.name || 'Someone',
  }))];

  return (
    <div style={styles.activeWrap}>
      <button style={styles.ringGroupBtn} onClick={ringGroup}>
        <BellSvg /> Ring everyone
      </button>
      <div style={styles.grid}>
        {tiles.map(t => (
          <VideoTile key={t.userId} stream={t.stream} label={t.label} isLocal={t.isLocal} isVideo={isVideo} muted={t.isLocal && muted} />
        ))}
      </div>
      <div style={styles.controlsRow}>
        <button style={{ ...styles.ctrlBtn, ...(muted ? { background: 'rgba(244,63,94,0.2)', borderColor: '#f43f5e' } : {}) }} onClick={toggleMute}>
          {muted ? <MicOffSvg color="#f43f5e" /> : <MicSvg />}
        </button>
        {isVideo && (
          <button style={{ ...styles.ctrlBtn, ...(videoOff ? { background: 'rgba(244,63,94,0.2)', borderColor: '#f43f5e' } : {}) }} onClick={toggleVideo}>
            {videoOff ? <VideoOffSvg color="#f43f5e" /> : <VideoSvg />}
          </button>
        )}
        <button style={{ ...styles.actionBtn, width: 54, height: 54, background: '#e11d48' }} onClick={leaveGroupCall}>
          <PhoneOffSvg />
        </button>
      </div>
    </div>
  );
}

// Small inline icon set — matching stroke style used elsewhere in the app
// (stroke="currentColor" strokeWidth="2"), kept local to this file since
// they're only used here.
function PhoneSvg({ color = '#fff' }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
}
function PhoneOffSvg({ color = '#fff' }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}
function MicSvg() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function MicOffSvg({ color }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function VideoSvg() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>;
}
function VideoOffSvg({ color }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /><path d="M23 7l-6.5 5L23 17V7z" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}
function BellSvg() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}

const styles = {
  ringWrap: { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999 },
  ringCard: {
    width: 380, maxWidth: '90vw', borderRadius: 24, overflow: 'hidden',
    background: 'rgba(10,12,18,0.97)', border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  },
  accentBar: { height: 3, width: '100%' },
  ringBody: { padding: 18, paddingBottom: 20 },
  ringHeaderRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28, background: '#2a2d36', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0,
  },
  name: { fontSize: 17, fontWeight: 700, color: '#f0f0f0' },
  statusText: { fontSize: 12, marginTop: 3, color: 'rgba(255,255,255,0.45)' },
  ringLeft: { fontSize: 12, fontWeight: 700, marginLeft: 8 },
  row: { display: 'flex', justifyContent: 'space-around' },
  actionBtn: {
    width: 64, height: 64, borderRadius: 32, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  activeWrap: { position: 'fixed', inset: 0, zIndex: 9990, background: '#0a0c12', display: 'flex', flexDirection: 'column' },
  roomFullToast: {
    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
    background: 'rgba(225,29,72,0.95)', borderRadius: 14, padding: '12px 20px', color: '#fff',
    fontSize: 12.5, fontWeight: 600, textAlign: 'center', maxWidth: 420,
  },
  ringGroupBtn: {
    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
    display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
    background: 'rgba(124,92,252,0.85)', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 12.5, fontWeight: 700,
  },
  grid: {
    flex: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center',
    gap: 8, padding: 60,
  },
  tile: {
    width: 220, height: 220, borderRadius: 14, overflow: 'hidden', background: '#1a1d24',
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  tileVideo: { width: '100%', height: '100%', objectFit: 'cover' },
  tileAvatar: {
    width: 72, height: 72, borderRadius: 36, background: '#2a2d36', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700,
  },
  tileLabel: {
    position: 'absolute', bottom: 6, left: 6, right: 6, background: 'rgba(0,0,0,0.45)',
    borderRadius: 8, padding: '3px 8px', color: '#fff', fontSize: 11, fontWeight: 600,
  },
  controlsRow: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', gap: 16,
  },
  ctrlBtn: {
    width: 54, height: 54, borderRadius: 27, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.18)', cursor: 'pointer',
  },
};
