import React, {
  createContext, useContext, useRef, useState, useCallback, useEffect,
} from 'react';
import { useAuth } from './AuthContext';
import { useWS } from './WebSocketContext';
import { ICE_SERVERS } from './CallContext';

// Web counterpart to mobile's GroupCallContext.js — same design, same
// signaling shape (reuses the pairwise /call.offer /call.answer /call.ice
// primitives tagged with a groupId, roster managed by
// GroupCallWsController's /call.group.invite /.join /.leave /.end /.peek).
// See that file's top comment for the full mesh join choreography and
// GroupCallWsController.java's top comment for the wire protocol.
//
// Room-based model: starting or joining a call is always quiet (just adds
// you to the room, no ringing) — /call.group.invite is a separate,
// explicit action exposed as a "Ring everyone" button inside the call,
// not something that fires automatically. peekRoom() lets the
// conversation view show "N people already in this call" without
// joining, so people can decide to drop in on their own.

const RING_SECONDS = 60;

const GroupCallContext = createContext(null);

export function GroupCallProvider({ children }) {
  const { user } = useAuth();
  const ws = useWS();
  const userId = user?.id;

  const wsRef = useRef(ws);
  useEffect(() => { wsRef.current = ws; }, [ws]);

  const [status, setStatus] = useState('idle'); // idle | ringing | active
  const [callType, setCallType] = useState('audio');
  const [groupInfo, setGroupInfo] = useState(null); // { groupId, name }
  const [inviter, setInviter] = useState(null); // { userId, name, avatar } — only while status === 'ringing'
  const [localStream, setLocalStream] = useState(null);
  const [participants, setParticipants] = useState(new Map()); // userId -> { userId, name, avatar, stream }
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [ringLeft, setRingLeft] = useState(RING_SECONDS);
  const [roomFullError, setRoomFullError] = useState(null); // { maxSize } | null
  const [roomPeek, setRoomPeek] = useState(new Map()); // groupId -> participants[]

  const statusRef = useRef('idle');
  const groupInfoRef = useRef(null);
  const callTypeRef = useRef('audio');
  const callIdRef = useRef(null);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { groupInfoRef.current = groupInfo; }, [groupInfo]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  const peersRef = useRef(new Map()); // userId -> RTCPeerConnection
  const iceBufRef = useRef(new Map()); // userId -> candidate[]
  const localStreamRef = useRef(null);
  const ringTimerRef = useRef(null);

  function clearRingTimer() {
    clearInterval(ringTimerRef.current);
    ringTimerRef.current = null;
  }

  function closePeer(remoteUserId) {
    const pc = peersRef.current.get(remoteUserId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch {}
      peersRef.current.delete(remoteUserId);
    }
    iceBufRef.current.delete(remoteUserId);
    setParticipants(prev => {
      if (!prev.has(remoteUserId)) return prev;
      const next = new Map(prev);
      next.delete(remoteUserId);
      return next;
    });
  }

  function cleanupAll() {
    clearRingTimer();
    peersRef.current.forEach(pc => {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch {}
    });
    peersRef.current.clear();
    iceBufRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (groupInfoRef.current?.groupId) {
      wsRef.current?.unsubscribeFromGroupCall?.(groupInfoRef.current.groupId);
    }
    callIdRef.current = null;
  }

  function resetState() {
    cleanupAll();
    setStatus('idle');
    setCallType('audio');
    setGroupInfo(null);
    setInviter(null);
    setLocalStream(null);
    setParticipants(new Map());
    setMuted(false);
    setVideoOff(false);
    setRingLeft(RING_SECONDS);
    statusRef.current = 'idle';
  }

  async function connectToPeer(remoteUserId, initiator) {
    if (peersRef.current.has(remoteUserId)) return peersRef.current.get(remoteUserId);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(remoteUserId, pc);
    const stream = new MediaStream();

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.publish) {
        wsRef.current.publish('/app/call.ice', {
          targetId: remoteUserId, senderId: userId,
          groupId: groupInfoRef.current?.groupId, callId: callIdRef.current,
          candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(remoteUserId);
    };

    pc.ontrack = (e) => {
      const srcTracks = e.streams?.[0] ? e.streams[0].getTracks() : [e.track];
      srcTracks.forEach(t => { if (!stream.getTracks().find(x => x.id === t.id)) stream.addTrack(t); });
      setParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(remoteUserId) || { userId: remoteUserId };
        next.set(remoteUserId, { ...existing, stream });
        return next;
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.publish?.('/app/call.offer', {
        targetId: remoteUserId, senderId: userId,
        senderName: user?.displayName || user?.username || '', senderAvatar: user?.profilePicture || '',
        groupId: groupInfoRef.current?.groupId, callId: callIdRef.current, callType: callTypeRef.current, sdp: offer,
      });
    }

    return pc;
  }

  async function getLocalMedia(type) {
    const constraints = type === 'video' ? { audio: true, video: { facingMode: 'user' } } : { audio: true, video: false };
    const ls = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = ls;
    setLocalStream(ls);
    return ls;
  }

  // Quiet by design — no invite here. See ringGroup() for the explicit
  // "notify everyone" action, which used to be automatic on start.
  const startGroupCall = useCallback(async (group, type) => {
    if (statusRef.current !== 'idle') return;
    try {
      const callId = `gcall_${Date.now()}`;
      callIdRef.current = callId;
      setGroupInfo(group);
      setCallType(type);
      await getLocalMedia(type);
      wsRef.current?.subscribeToGroupCall?.(group.groupId);
      wsRef.current?.publish?.('/app/call.group.join', {
        groupId: group.groupId, callId, name: user?.displayName || user?.username || '', avatar: user?.profilePicture || '',
      });
      setStatus('active');
    } catch (err) {
      console.error('[GroupCallContext] startGroupCall:', err);
      resetState();
    }
  }, [user]);

  const acceptGroupCall = useCallback(async () => {
    if (statusRef.current !== 'ringing' || !groupInfoRef.current) return;
    clearRingTimer();
    const group = groupInfoRef.current;
    const type = callTypeRef.current;
    try {
      await getLocalMedia(type);
      wsRef.current?.subscribeToGroupCall?.(group.groupId);
      wsRef.current?.publish?.('/app/call.group.join', {
        groupId: group.groupId, callId: callIdRef.current,
        name: user?.displayName || user?.username || '', avatar: user?.profilePicture || '',
      });
      setStatus('active');
      setInviter(null);
    } catch (err) {
      console.error('[GroupCallContext] acceptGroupCall:', err);
      resetState();
    }
  }, [user]);

  const declineGroupCall = useCallback(() => {
    if (statusRef.current !== 'ringing') return;
    resetState();
  }, []);

  // Silent join — used when a 1:1 call upgrades to a group room (see
  // CallContext.js's upgradeToGroup()). No ringing state.
  const autoJoinRoom = useCallback(async (roomId, type) => {
    if (statusRef.current !== 'idle') return;
    try {
      const callId = `adhoc_${Date.now()}`;
      callIdRef.current = callId;
      setGroupInfo({ groupId: roomId });
      setCallType(type || 'audio');
      await getLocalMedia(type || 'audio');
      wsRef.current?.subscribeToGroupCall?.(roomId);
      wsRef.current?.publish?.('/app/call.group.join', {
        groupId: roomId, callId, name: user?.displayName || user?.username || '', avatar: user?.profilePicture || '',
      });
      setStatus('active');
    } catch (err) {
      console.error('[GroupCallContext] autoJoinRoom:', err);
      resetState();
    }
  }, [user]);

  const leaveGroupCall = useCallback(() => {
    if (statusRef.current === 'idle') return;
    if (statusRef.current === 'active' && groupInfoRef.current?.groupId) {
      wsRef.current?.publish?.('/app/call.group.leave', {
        groupId: groupInfoRef.current.groupId, callId: callIdRef.current,
      });
    }
    resetState();
  }, []);

  const ringGroup = useCallback(() => {
    if (statusRef.current !== 'active' || !groupInfoRef.current) return;
    wsRef.current?.publish?.('/app/call.group.invite', {
      groupId: groupInfoRef.current.groupId, type: callTypeRef.current, callId: callIdRef.current,
      callerName: user?.displayName || user?.username || '', callerAvatar: user?.profilePicture || '',
    });
  }, [user]);

  const peekRoom = useCallback((groupId) => {
    if (!groupId) return;
    wsRef.current?.subscribeToGroupCall?.(groupId);
    wsRef.current?.publish?.('/app/call.group.peek', { groupId });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setVideoOff(prev => {
      const next = !prev;
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }, []);

  const handleMsg = useCallback((msg) => {
    const msgType = msg._type || msg.type;
    const self = userId;

    if (msgType === 'CALL_END' && msg.upgradingToRoomId) {
      autoJoinRoom(msg.upgradingToRoomId, msg.upgradingCallType).catch(e => console.error('[GroupCall] autoJoinRoom:', e));
      return;
    }

    if (msgType === 'GROUP_CALL_ROOM_FULL') {
      resetState();
      setRoomFullError({ maxSize: msg.maxSize || 4 });
      setTimeout(() => setRoomFullError(null), 4000);
      return;
    }

    if (msgType === 'GROUP_CALL_INVITE') {
      if (String(msg.callerId) === String(self)) return;
      if (statusRef.current !== 'idle') return;
      callIdRef.current = msg.callId;
      setGroupInfo({ groupId: msg.groupId });
      setCallType(msg.callType || 'audio');
      setInviter({ userId: msg.callerId, name: msg.callerName || 'Someone', avatar: msg.callerAvatar || null });
      setRingLeft(RING_SECONDS);
      setStatus('ringing');
      ringTimerRef.current = setInterval(() => {
        setRingLeft(t => {
          if (t <= 1) { clearRingTimer(); resetState(); return 0; }
          return t - 1;
        });
      }, 1000);
      return;
    }

    if (msgType === 'GROUP_CALL_PEEK_RESULT') {
      setRoomPeek(prev => {
        const next = new Map(prev);
        next.set(Number(msg.groupId), msg.participants || []);
        return next;
      });
      return;
    }

    if (msgType === 'GROUP_CALL_ROSTER') {
      if (statusRef.current !== 'active' || !groupInfoRef.current || Number(msg.groupId) !== Number(groupInfoRef.current.groupId)) return;
      setParticipants(prev => {
        const next = new Map(prev);
        (msg.participants || []).forEach(p => {
          if (String(p.userId) === String(self)) return;
          if (!next.has(p.userId)) next.set(p.userId, { userId: p.userId, name: p.name, avatar: p.avatar });
        });
        return next;
      });
      return;
    }

    if (msgType === 'GROUP_CALL_JOIN') {
      if (String(msg.userId) === String(self)) return;
      if (statusRef.current !== 'active' || !groupInfoRef.current || Number(msg.groupId) !== Number(groupInfoRef.current.groupId)) return;
      setParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(msg.userId) || {};
        next.set(msg.userId, { ...existing, userId: msg.userId, name: msg.name, avatar: msg.avatar });
        return next;
      });
      connectToPeer(msg.userId, true).catch(e => console.error('[GroupCall] connectToPeer:', e));
      return;
    }

    if (msgType === 'GROUP_CALL_LEAVE') {
      if (!groupInfoRef.current || Number(msg.groupId) !== Number(groupInfoRef.current.groupId)) return;
      closePeer(msg.userId);
      return;
    }

    if (msgType === 'GROUP_CALL_END') {
      if (!groupInfoRef.current || Number(msg.groupId) !== Number(groupInfoRef.current.groupId)) return;
      resetState();
      return;
    }

    if (!msg.groupId || !groupInfoRef.current || Number(msg.groupId) !== Number(groupInfoRef.current.groupId)) return;
    if (String(msg.senderId) === String(self)) return;

    if (msgType === 'CALL_OFFER') {
      (async () => {
        const pc = await connectToPeer(msg.senderId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const buffered = iceBufRef.current.get(msg.senderId) || [];
        iceBufRef.current.set(msg.senderId, []);
        for (const c of buffered) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('[GroupCall ICE] drain error:', e); }
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.publish?.('/app/call.answer', {
          targetId: msg.senderId, senderId: userId,
          groupId: groupInfoRef.current.groupId, callId: callIdRef.current, sdp: answer,
        });
      })().catch(e => console.error('[GroupCall] CALL_OFFER handling error:', e));
      return;
    }

    if (msgType === 'CALL_ANSWER') {
      const pc = peersRef.current.get(msg.senderId);
      if (!pc || pc.signalingState !== 'have-local-offer') return;
      (async () => {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const buffered = iceBufRef.current.get(msg.senderId) || [];
        iceBufRef.current.set(msg.senderId, []);
        for (const c of buffered) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn('[GroupCall ICE] drain error:', e); }
        }
      })().catch(e => console.error('[GroupCall] CALL_ANSWER handling error:', e));
      return;
    }

    if (msgType === 'CALL_ICE') {
      if (!msg.candidate) return;
      const pc = peersRef.current.get(msg.senderId);
      const candidateInit = typeof msg.candidate === 'string'
        ? { candidate: msg.candidate, sdpMid: msg.sdpMid ?? '0', sdpMLineIndex: msg.sdpMLineIndex ?? 0 }
        : msg.candidate;
      if (!pc || !pc.remoteDescription) {
        const buf = iceBufRef.current.get(msg.senderId) || [];
        buf.push(candidateInit);
        iceBufRef.current.set(msg.senderId, buf);
        return;
      }
      pc.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(e => console.warn('[GroupCall ICE] addIceCandidate error:', e));
    }
  }, [userId, user, autoJoinRoom]);

  useEffect(() => {
    if (!ws || !userId) return;
    return ws.subscribe(handleMsg);
  }, [ws, userId, handleMsg]);

  useEffect(() => () => cleanupAll(), []);

  const value = {
    status, callType, groupInfo, inviter, localStream, participants,
    muted, videoOff, ringLeft, roomPeek, roomFullError,
    startGroupCall, acceptGroupCall, declineGroupCall, leaveGroupCall, ringGroup, peekRoom,
    autoJoinRoom, toggleMute, toggleVideo,
  };

  return <GroupCallContext.Provider value={value}>{children}</GroupCallContext.Provider>;
}

export function useGroupCall() {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error('[GroupCallContext] useGroupCall() must be used inside <GroupCallProvider>');
  return ctx;
}
