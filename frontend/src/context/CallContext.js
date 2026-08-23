import React, {
  createContext, useContext, useRef, useState,
  useCallback, useEffect,
} from 'react';
import { useAuth } from './AuthContext';
import { useWS }   from './WebSocketContext';

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:80', username: 'cde1451e34792ad0af312bf7', credential: 'sX0fgEuL7XNIE+Uc' },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'cde1451e34792ad0af312bf7', credential: 'sX0fgEuL7XNIE+Uc' },
    { urls: 'turn:global.relay.metered.ca:443', username: 'cde1451e34792ad0af312bf7', credential: 'sX0fgEuL7XNIE+Uc' },
    { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'cde1451e34792ad0af312bf7', credential: 'sX0fgEuL7XNIE+Uc' },
  ],
};

const RING_SECONDS = 60;

import ringtoneFile from '../ringtone.mp3';

// Module-level singleton — one audio element for the lifetime of the app.
// Created lazily (not at module load) to avoid autoplay policy issues and
// to prevent React StrictMode double-invocation from creating two instances.
let _ringtoneAudio = null;

function getRingtoneAudio() {
  if (_ringtoneAudio) return _ringtoneAudio;
  _ringtoneAudio = new Audio(ringtoneFile);
  _ringtoneAudio.loop   = true;
  _ringtoneAudio.volume = 1.0;

  // Prevent the OS/browser from registering this as controllable media.
  // Without this, device media buttons (headphones, lock screen, car audio)
  // will pause/play the ringtone as if it were music — very wrong behavior.
  if ('mediaSession' in navigator) {
    // We override handlers on play/pause so that whenever this element starts
    // playing, media session actions are no-ops rather than controlling it.
    _ringtoneAudio.addEventListener('play', _lockMediaSession);
    _ringtoneAudio.addEventListener('pause', _restoreMediaSession);
  }

  return _ringtoneAudio;
}

// Stores whatever mediaSession metadata/handlers existed before the ringtone
// started, so we can restore them when the ringtone stops.
let _savedMediaMetadata = null;

function _lockMediaSession() {
  if (!('mediaSession' in navigator)) return;
  _savedMediaMetadata = navigator.mediaSession.metadata;
  // Blank metadata so the OS shows nothing for this "media"
  navigator.mediaSession.metadata = null;
  // Override all action handlers to no-ops so media buttons do nothing
  ['play', 'pause', 'stop', 'nexttrack', 'previoustrack'].forEach(action => {
    try { navigator.mediaSession.setActionHandler(action, () => {}); } catch {}
  });
}

function _restoreMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = _savedMediaMetadata;
  _savedMediaMetadata = null;
  // Clear our no-op overrides so normal media controls work again
  ['play', 'pause', 'stop', 'nexttrack', 'previoustrack'].forEach(action => {
    try { navigator.mediaSession.setActionHandler(action, null); } catch {}
  });
}

// Unlock audio context on first user gesture so ringtone can play on mobile.
// Uses { once: true } so each listener fires at most once — no manual cleanup.
function _unlockAudio() {
  const audio = getRingtoneAudio();
  // Only unlock if not currently ringing (don't interrupt an active ring)
  if (!audio.paused) return;
  audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
  }).catch(() => {});
}
document.addEventListener('click',      _unlockAudio, { once: true });
document.addEventListener('keydown',    _unlockAudio, { once: true });
document.addEventListener('touchstart', _unlockAudio, { once: true });

function createRingtone() {
  const audio = getRingtoneAudio();
  // Guard: if already playing (e.g. StrictMode double-call), don't restart
  if (!audio.paused) return { stop() { audio.loop = false; audio.pause(); audio.currentTime = 0; } };
  audio.currentTime = 0;
  audio.loop = true;
  audio.play().catch(() => {});
  return { stop() { audio.loop = false; audio.pause(); audio.currentTime = 0; } };
}

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { user } = useAuth();
  const ws       = useWS();
  const userId   = user?.id;

  const wsRef = useRef(ws);
  useEffect(() => { wsRef.current = ws; }, [ws]);

  const [status,        setStatus]        = useState('idle');
  const [callType,      setCallType]      = useState('audio');
  const [remoteUser,    setRemoteUser]    = useState(null);
  const [localStream,   setLocalStream]   = useState(null);
  const [muted,         setMuted]         = useState(false);
  const [videoOff,      setVideoOff]      = useState(false);
  const [ringLeft,      setRingLeft]      = useState(RING_SECONDS);
  const [reconnecting,  setReconnecting]  = useState(false);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const callStartedAtRef = useRef(null);

  // ── KEY CHANGE: remoteStream is a ref, NOT state ──────────────
  // Exposing the MediaStream object as React state means every call to
  // setRemoteStream (even with the same object) can schedule a re-render.
  // On mobile browsers a re-render while a <video> element is playing
  // causes a brief pipeline stall = visible blink every ~1 s.
  // Instead we store it in a ref and expose a stable getter. CallScreen
  // wires srcObject once via a callback ref; it never needs to re-render
  // because the stream object changed.
  const remoteStreamRef = useRef(new MediaStream());

  // A single incrementing counter that CallScreen can use as a signal
  // that a new track arrived and it should re-wire srcObject — but only
  // if the element doesn't already have it.
  const [remoteTrackVersion, setRemoteTrackVersion] = useState(0);

  const statusRef     = useRef('idle');
  const remoteUserRef = useRef(null);
  const callTypeRef   = useRef('audio');

  useEffect(() => { statusRef.current     = status;     }, [status]);
  useEffect(() => { remoteUserRef.current = remoteUser; }, [remoteUser]);
  useEffect(() => { callTypeRef.current   = callType;   }, [callType]);

  const peerRef         = useRef(null);
  const pendingOfferRef = useRef(null);
  const iceBufRef       = useRef([]);
  const localStreamRef  = useRef(null);
  const activeCallIdRef = useRef(null);
  const callInProgressRef = useRef(false);
  const iceRecoveryTimerRef = useRef(null);
  const remoteAudioRef  = useRef(null);
  const endCallRef      = useRef(null);
  const ringtoneRef     = useRef(null);
  const ringTimerRef    = useRef(null);
  const ringExpiredCheckRef = useRef(null);

  function stopRingtone() {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }

  function clearRingTimer() {
    clearInterval(ringTimerRef.current);
    ringTimerRef.current = null;
    clearInterval(ringExpiredCheckRef.current);
    ringExpiredCheckRef.current = null;
  }

  function attachAudio() {
    const el     = remoteAudioRef.current;
    const stream = remoteStreamRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (!callStartedAtRef.current) return;
    el.play().catch(err => {
      console.warn('[Audio] autoplay blocked, will retry:', err.message);
      const retry = () => { el.play().catch(() => {}); document.removeEventListener('click', retry); document.removeEventListener('touchstart', retry); };
      document.addEventListener('click',      retry, { once: true });
      document.addEventListener('touchstart', retry, { once: true });
    });
  }

  function attachAudioWithRetry(maxAttempts = 10) {
    let attempts = 0;
    function attempt() {
      const el     = remoteAudioRef.current;
      const stream = remoteStreamRef.current;
      if (el && stream && stream.getTracks().length > 0) { attachAudio(); return; }
      if (++attempts < maxAttempts) setTimeout(attempt, 200);
    }
    attempt();
  }

  async function drainIceBuf(pc) {
    if (!pc.remoteDescription) { console.warn('[ICE] drainIceBuf called before remoteDescription'); return; }
    const buf = iceBufRef.current.splice(0);
    console.log('[ICE] draining', buf.length, 'buffered candidates');
    for (const c of buf) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
      catch (e) { console.warn('[ICE] drain error:', e); }
    }
  }

  function cleanupPeer() {
    clearRingTimer();
    stopRingtone();
    if (iceRecoveryTimerRef.current) { clearTimeout(iceRecoveryTimerRef.current); iceRecoveryTimerRef.current = null; }
    if (peerRef.current) {
      peerRef.current.ontrack                   = null;
      peerRef.current.onicecandidate             = null;
      peerRef.current.oniceconnectionstatechange  = null;
      peerRef.current.onicegatheringstatechange   = null;
      peerRef.current.onconnectionstatechange     = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    remoteStreamRef.current = new MediaStream();
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    iceBufRef.current         = [];
    pendingOfferRef.current   = null;
    activeCallIdRef.current   = null;
    callInProgressRef.current = false;
  }

  function resetState() {
    cleanupPeer();
    setStatus('idle');
    setCallType('audio');
    setRemoteUser(null);
    setLocalStream(null);
    setRemoteTrackVersion(0);
    setCallStartedAt(null);
    callStartedAtRef.current = null;
    setMuted(false);
    setVideoOff(false);
    setReconnecting(false);
    setRingLeft(RING_SECONDS);
    statusRef.current = 'idle';
  }

  function markCallStarted() {
    const now = Date.now();
    callStartedAtRef.current = now;
    setCallStartedAt(prev => { if (prev !== null) return prev; console.log('[Call] media connected — starting timer'); return now; });
    attachAudio();
  }

  function buildPeer(remoteUserId) {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    remoteStreamRef.current = new MediaStream();

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = pc;

    pc.onicecandidate = e => {
      if (e.candidate && wsRef.current?.publish) {
        wsRef.current.publish('/app/call.ice', { targetId: remoteUserId, senderId: userId, callId: activeCallIdRef.current, candidate: e.candidate });
      }
    };

    pc.onicegatheringstatechange = () => { console.log('[WebRTC] ICE gathering:', pc.iceGatheringState); };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] connection state:', state);
      if (state === 'connected') markCallStarted();
      if (state === 'failed') { console.log('[WebRTC] connection failed — ending call'); endCallRef.current?.(); }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC] ICE state:', state);
      if (state === 'connected' || state === 'completed') {
        if (iceRecoveryTimerRef.current) { clearTimeout(iceRecoveryTimerRef.current); iceRecoveryTimerRef.current = null; }
        setReconnecting(false);
        markCallStarted();
        attachAudioWithRetry();
      }
      if (state === 'disconnected') {
        if (!iceRecoveryTimerRef.current) {
          setReconnecting(true);
          iceRecoveryTimerRef.current = setTimeout(() => {
            iceRecoveryTimerRef.current = null;
            if (peerRef.current?.iceConnectionState === 'disconnected') { console.warn('[WebRTC] ICE recovery timed out'); endCallRef.current?.(); }
          }, 8000);
        }
      }
      if (state === 'failed') {
        if (iceRecoveryTimerRef.current) { clearTimeout(iceRecoveryTimerRef.current); iceRecoveryTimerRef.current = null; }
        setReconnecting(false);
        endCallRef.current?.();
      }
      if (state === 'closed') {
        if (iceRecoveryTimerRef.current) { clearTimeout(iceRecoveryTimerRef.current); iceRecoveryTimerRef.current = null; }
        setReconnecting(false);
      }
    };

    pc.ontrack = e => {
      console.log('[WebRTC] ontrack — streams:', e.streams?.length, 'kind:', e.track.kind);
      const stream    = remoteStreamRef.current;
      const srcTracks = e.streams?.[0] ? e.streams[0].getTracks() : [e.track];
      srcTracks.forEach(t => { if (!stream.getTracks().find(x => x.id === t.id)) stream.addTrack(t); });
      attachAudioWithRetry();
      // ── KEY CHANGE: do NOT call setRemoteStream(stream) here ──
      // Incrementing a version number signals CallScreen to re-wire srcObject
      // without passing a new stream object through React state, which would
      // cause a re-render and a mobile video blink.
      setRemoteTrackVersion(n => n + 1);
    };

    return pc;
  }

  const startCall = useCallback(async (type, targetUser) => {
    if (statusRef.current !== 'idle') return;
    if (callInProgressRef.current)    return;
    callInProgressRef.current = true;
    try {
      const constraints = type === 'video' ? { audio: true, video: true } : { audio: true, video: false };
      const ls = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = ls;
      const callId = `call_${Date.now()}`;
      activeCallIdRef.current = callId;
      const pc = buildPeer(targetUser.userId);
      ls.getTracks().forEach(t => pc.addTrack(t, ls));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.publish?.('/app/call.offer', { targetId: targetUser.userId, senderId: userId, senderName: user?.displayName || user?.username || '', senderAvatar: user?.profilePicture || '', callId, callType: type, sdp: offer });
      setCallType(type);
      setRemoteUser(targetUser);
      setLocalStream(ls);
      setMuted(false);
      setVideoOff(false);
      setStatus('calling');
    } catch (err) {
      console.error('[CallContext] startCall:', err);
      callInProgressRef.current = false;
      resetState();
    }
  }, [userId, user]);

  const acceptCall = useCallback(async () => {
    if (statusRef.current !== 'incoming') return;
    if (callInProgressRef.current)        return;
    callInProgressRef.current = true;
    const pendingOffer    = pendingOfferRef.current;
    const remote          = remoteUserRef.current;
    const type            = callTypeRef.current;
    const iceBufSnapshot  = iceBufRef.current.splice(0);
    statusRef.current = 'active';
    clearRingTimer();
    stopRingtone();
    try {
      const constraints = type === 'video' ? { audio: true, video: true } : { audio: true, video: false };
      const ls = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = ls;
      const pc = buildPeer(remote.userId);
      ls.getTracks().forEach(t => pc.addTrack(t, ls));
      if (pendingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
        console.log('[ICE] draining snapshot:', iceBufSnapshot.length, '+ live:', iceBufRef.current.length);
        for (const c of [...iceBufSnapshot, ...iceBufRef.current.splice(0)]) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('[ICE] drain error:', e); }
        }
      }
      if (statusRef.current === 'idle') { ls.getTracks().forEach(t => t.stop()); return; }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.publish?.('/app/call.answer', { targetId: remote.userId, senderId: userId, senderName: user?.displayName || user?.username || '', senderAvatar: user?.profilePicture || '', callId: activeCallIdRef.current, sdp: answer });
      setLocalStream(ls);
      setMuted(false);
      setVideoOff(false);
      setStatus('active');
      attachAudioWithRetry();
    } catch (err) {
      console.error('[CallContext] acceptCall:', err);
      callInProgressRef.current = false;
      resetState();
    }
  }, [userId, user]);

  const declineCall = useCallback(() => {
    if (statusRef.current !== 'incoming') return;
    wsRef.current?.publish?.('/app/call.decline', { targetId: remoteUserRef.current?.userId, senderId: userId, callId: activeCallIdRef.current });
    resetState();
  }, [userId]);

  const endCall = useCallback(() => {
    const current = statusRef.current;
    if (current === 'idle') return;
    const targetId = remoteUserRef.current?.userId;
    if (targetId && (current === 'calling' || current === 'active')) {
      wsRef.current?.publish?.('/app/call.end', { targetId, senderId: userId, callId: activeCallIdRef.current });
    }
    resetState();
  }, [userId]);

  endCallRef.current = endCall;

  const toggleMute = useCallback(() => {
    setMuted(prev => { const next = !prev; localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; }); return next; });
  }, []);

  const toggleVideo = useCallback(() => {
    setVideoOff(prev => { const next = !prev; localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; }); return next; });
  }, []);

  const handleMsg = useCallback((msg) => {
    const msgType = msg._type || msg.type;
    const self    = userId;
    if (String(msg.senderId) === String(self) || String(msg.callerId) === String(self)) return;
    console.log('[Call] received:', msgType, '| self:', self, '| sender:', msg.senderId);

    if (msgType === 'CALL_OFFER' || msgType === 'CALL_INCOMING') {
      if (statusRef.current !== 'idle') {
        const isSameCallRedelivery = statusRef.current === 'incoming' && msg.callId && msg.callId === activeCallIdRef.current;
        if (!isSameCallRedelivery) {
          console.log('[Call] CALL_OFFER ignored, already in phase:', statusRef.current);
          if (msg.callId !== activeCallIdRef.current) wsRef.current?.publish?.('/app/call.decline', { targetId: msg.senderId || msg.callerId, senderId: self, callId: msg.callId });
          return;
        }
        pendingOfferRef.current = msg.sdp || pendingOfferRef.current;
        return;
      }
      let resolvedCallType = msg.callType || (msg.videoEnabled ? 'video' : 'audio');
      if (resolvedCallType === 'CALL_OFFER' || resolvedCallType === 'CALL_INCOMING') resolvedCallType = msg.videoEnabled ? 'video' : 'audio';
      const callId = msg.callId || msg.id || `call_${Date.now()}`;
      activeCallIdRef.current = callId;
      pendingOfferRef.current = msg.sdp || null;
      iceBufRef.current       = [];
      console.log('[Call] CALL_OFFER — callId:', callId, 'callType:', resolvedCallType, 'hasSdp:', !!msg.sdp);
      setCallType(resolvedCallType);
      setRemoteUser({ userId: msg.senderId || msg.callerId, name: msg.senderName || msg.callerName || 'Unknown', avatar: msg.senderAvatar || msg.callerAvatar || null });
      setRingLeft(RING_SECONDS);
      setStatus('incoming');
      if (!ringtoneRef.current) ringtoneRef.current = createRingtone();
      ringTimerRef.current = setInterval(() => { setRingLeft(t => t <= 1 ? 0 : t - 1); }, 1000);
      ringExpiredCheckRef.current = setInterval(() => {
        setRingLeft(t => {
          if (t <= 0) {
            clearInterval(ringExpiredCheckRef.current);
            ringExpiredCheckRef.current = null;
            setTimeout(() => {
              if (statusRef.current !== 'incoming') return;
              stopRingtone(); clearRingTimer();
              wsRef.current?.publish?.('/app/call.decline', { targetId: remoteUserRef.current?.userId, senderId: self, callId: activeCallIdRef.current });
              resetState();
            }, 0);
          }
          return t;
        });
      }, 500);
      return;
    }

    if (msgType === 'CALL_ANSWER') {
      const pc = peerRef.current;
      if (!pc || (statusRef.current !== 'calling' && statusRef.current !== 'active')) return;
      if (pc.signalingState === 'stable') return;
      (async () => {
        try {
          if (pc.signalingState !== 'have-local-offer') { console.warn('[Call] CALL_ANSWER ignored — signalingState:', pc.signalingState); return; }
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await drainIceBuf(pc);
          console.log('[Call] CALL_ANSWER processed — switching to active');
          statusRef.current = 'active';
          setStatus('active');
          attachAudioWithRetry();
        } catch (err) { console.error('[Call] CALL_ANSWER error:', err); }
      })();
      return;
    }

    if (msgType === 'CALL_ICE') {
      if (!msg.candidate) return;
      if (msg.callId && activeCallIdRef.current && msg.callId !== activeCallIdRef.current) { console.log('[ICE] ignoring stale candidate'); return; }
      const raw = msg.candidate;
      let candidateInit;
      if (typeof raw === 'string') candidateInit = { candidate: raw, sdpMid: msg.sdpMid ?? '0', sdpMLineIndex: msg.sdpMLineIndex ?? 0 };
      else if (raw && typeof raw.candidate === 'string') candidateInit = raw;
      else { console.warn('[ICE] unexpected candidate shape:', raw); return; }
      const pc = peerRef.current;
      if (!pc) { if (statusRef.current !== 'idle') { iceBufRef.current.push(candidateInit); console.log('[ICE] buffered (no pc yet), size:', iceBufRef.current.length); } return; }
      console.log('[ICE] received — hasRemoteDesc:', !!pc.remoteDescription, '|', candidateInit.candidate?.slice(0, 60));
      if (!pc.remoteDescription) { iceBufRef.current.push(candidateInit); return; }
      pc.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(e => console.warn('[ICE] addIceCandidate error:', e));
      return;
    }

    if (msgType === 'CALL_END' || msgType === 'CALL_ENDED' || msgType === 'CALL_DECLINE' || msgType === 'CALL_DECLINED') {
      const phase = statusRef.current;
      if (phase === 'idle') return;
      if ((msgType === 'CALL_DECLINE' || msgType === 'CALL_DECLINED') && phase === 'active') { console.log('[Call] ignoring stale CALL_DECLINE'); return; }
      if (msg.callId && activeCallIdRef.current && msg.callId !== activeCallIdRef.current) { console.log('[Call] ignoring stale CALL_END for old callId:', msg.callId); return; }
      console.log('[Call] remote ended/declined (phase:', phase, ')');
      resetState();
    }
  }, [userId]);

  useEffect(() => {
    if (!ws || !userId) return;
    return ws.subscribe(handleMsg);
  }, [ws, userId, handleMsg]);

  useEffect(() => () => cleanupPeer(), []);

  const value = {
    status, callType, remoteUser, localStream,
    // ── remoteStream is now exposed as a getter that reads the ref ──
    // CallScreen must use this as a ref-style value: wire srcObject once,
    // and use remoteTrackVersion as the signal to re-check.
    get remoteStream() { return remoteStreamRef.current; },
    remoteTrackVersion,  // replaces remoteTrackCount — same purpose, cleaner name
    muted, videoOff, ringLeft, reconnecting, callStartedAt,
    startCall, acceptCall, declineCall, endCall, toggleMute, toggleVideo,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('[CallContext] useCall() must be used inside <CallProvider>');
  return ctx;
}