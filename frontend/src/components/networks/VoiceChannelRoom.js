import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ICE_SERVERS } from '../../context/CallContext';
import UserAvatar from '../UserAvatar';

/**
 * A network VOICE channel — everyone who's "in" it sits in the same room
 * (no ringing, no accept/decline, just join/leave), which is a different
 * shape than the 1:1 ringing calls CallContext handles for DMs. This talks
 * to VoiceChannelWsController on the backend directly over the channel's
 * own WS topic instead of reusing CallContext.
 *
 * Topology: mesh — every participant opens a direct RTCPeerConnection to
 * every other participant. Simple and needs no media server, but doesn't
 * scale past a handful of people (each join adds a connection to everyone
 * already there); fine for the small-room case this is built for.
 *
 * Glare avoidance: when two participants both discover each other in a
 * roster update at the same time, only the one with the numerically
 * smaller userId sends the offer — both sides compute this independently
 * from the same roster broadcast, so exactly one offer gets sent per pair
 * with no coordination needed.
 */
export default function VoiceChannelRoom({ networkId, channel, currentUserId }) {
  const [participants, setParticipants] = useState([]); // from VOICE_ROSTER
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  // Bumped on any remote track arrival so audio elements re-check srcObject
  // without needing the MediaStream objects themselves in React state.
  const [streamVersion, setStreamVersion] = useState(0);

  const channelIdRef = useRef(channel.id);
  channelIdRef.current = channel.id;
  const joinedRef = useRef(false);
  joinedRef.current = joined;

  const localStreamRef = useRef(null);
  const peersRef = useRef({});          // userId -> RTCPeerConnection
  const remoteStreamsRef = useRef({});  // userId -> MediaStream
  const iceBufRef = useRef({});         // userId -> candidate[] buffered before remoteDescription is set
  const audioRefs = useRef({});         // userId -> <audio> element

  function buildPeer(remoteUserId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[remoteUserId] = pc;
    iceBufRef.current[remoteUserId] = iceBufRef.current[remoteUserId] || [];

    pc.onicecandidate = e => {
      if (e.candidate) {
        publish('/app/voice.ice', {
          channelId: channelIdRef.current, targetUserId: remoteUserId, candidate: e.candidate,
        });
      }
    };
    pc.ontrack = e => {
      const stream = remoteStreamsRef.current[remoteUserId] || new MediaStream();
      const incoming = e.streams?.[0] ? e.streams[0].getTracks() : [e.track];
      incoming.forEach(t => { if (!stream.getTracks().find(x => x.id === t.id)) stream.addTrack(t); });
      remoteStreamsRef.current[remoteUserId] = stream;
      setStreamVersion(v => v + 1);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeer(remoteUserId);
      }
    };
    return pc;
  }

  function closePeer(remoteUserId) {
    const pc = peersRef.current[remoteUserId];
    if (pc) {
      pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null;
      pc.close();
      delete peersRef.current[remoteUserId];
    }
    delete remoteStreamsRef.current[remoteUserId];
    delete iceBufRef.current[remoteUserId];
    delete audioRefs.current[remoteUserId];
    setStreamVersion(v => v + 1);
  }

  async function offerTo(remoteUserId) {
    if (!localStreamRef.current || peersRef.current[remoteUserId]) return;
    const pc = buildPeer(remoteUserId);
    localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    publish('/app/voice.offer', { channelId: channelIdRef.current, targetUserId: remoteUserId, sdp: offer });
  }

  async function handleOffer(fromUserId, sdp) {
    if (!localStreamRef.current) return; // not actually in the room (stale message)
    let pc = peersRef.current[fromUserId];
    if (!pc) pc = buildPeer(fromUserId);
    localStreamRef.current.getTracks().forEach(t => {
      if (!pc.getSenders().find(s => s.track === t)) pc.addTrack(t, localStreamRef.current);
    });
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const buffered = iceBufRef.current[fromUserId] || [];
    iceBufRef.current[fromUserId] = [];
    for (const c of buffered) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    publish('/app/voice.answer', { channelId: channelIdRef.current, targetUserId: fromUserId, sdp: answer });
  }

  async function handleAnswer(fromUserId, sdp) {
    const pc = peersRef.current[fromUserId];
    if (!pc || pc.signalingState !== 'have-local-offer') return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const buffered = iceBufRef.current[fromUserId] || [];
    iceBufRef.current[fromUserId] = [];
    for (const c of buffered) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
  }

  function handleIce(fromUserId, candidate) {
    if (!candidate) return;
    const pc = peersRef.current[fromUserId];
    if (pc && pc.remoteDescription) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      iceBufRef.current[fromUserId] = iceBufRef.current[fromUserId] || [];
      iceBufRef.current[fromUserId].push(candidate);
    }
  }

  function handleRoster(list) {
    setParticipants(list);
    if (!joinedRef.current) return; // just spectating the list before joining
    const stillHereIds = new Set(list.map(p => String(p.userId)));
    // Departed — close their connection.
    Object.keys(peersRef.current).forEach(uid => {
      if (!stillHereIds.has(String(uid))) closePeer(uid);
    });
    // Newly visible — exactly one side offers (see glare-avoidance note above).
    list.forEach(p => {
      if (String(p.userId) === String(currentUserId)) return;
      if (peersRef.current[p.userId]) return;
      if (Number(currentUserId) < Number(p.userId)) offerTo(p.userId);
    });
  }

  const handleWsMessage = useCallback((msg) => {
    if (String(msg.channelId) !== String(channelIdRef.current)) return;
    switch (msg._type) {
      case 'VOICE_ROSTER': handleRoster(msg.participants || []); break;
      case 'VOICE_OFFER':  if (String(msg.targetUserId) === String(currentUserId)) handleOffer(msg.senderId, msg.sdp); break;
      case 'VOICE_ANSWER': if (String(msg.targetUserId) === String(currentUserId)) handleAnswer(msg.senderId, msg.sdp); break;
      case 'VOICE_ICE':    if (String(msg.targetUserId) === String(currentUserId)) handleIce(msg.senderId, msg.candidate); break;
      default: break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const { publish, subscribeToChannel } = useWebSocket(currentUserId, handleWsMessage);
  useEffect(() => { if (channel?.id) subscribeToChannel(channel.id); }, [channel?.id, subscribeToChannel]);

  function cleanupLocal() {
    Object.keys(peersRef.current).forEach(closePeer);
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    setJoined(false);
    setMuted(false);
  }

  // Leaving without an explicit click — switching channels, closing the
  // panel, navigating away within the app — still has to notify the server.
  // A full tab close is instead caught server-side by the STOMP disconnect
  // listener (see VoiceChannelWsController#handleDisconnect), since this
  // cleanup function has no chance to run in that case.
  useEffect(() => {
    return () => {
      if (joinedRef.current) {
        publish('/app/voice.leave', { channelId: channelIdRef.current });
        cleanupLocal();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  async function handleJoin() {
    if (joined || connecting) return;
    setConnecting(true); setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setJoined(true);
      joinedRef.current = true;
      publish('/app/voice.join', { channelId: channel.id });
    } catch (err) {
      console.error('[VoiceChannelRoom] mic error:', err);
      setError('Could not access microphone.');
    } finally {
      setConnecting(false);
    }
  }

  function handleLeave() {
    publish('/app/voice.leave', { channelId: channel.id });
    cleanupLocal();
  }

  function toggleMute() {
    setMuted(prev => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      publish('/app/voice.mute', { channelId: channel.id, muted: next });
      return next;
    });
  }

  const selfInRoom = joined;
  const others = participants.filter(p => String(p.userId) !== String(currentUserId));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
      {/* Hidden playback elements — one per remote participant's stream. */}
      {others.map(p => (
        <audio
          key={p.userId}
          autoPlay
          playsInline
          ref={el => {
            audioRefs.current[p.userId] = el;
            const stream = remoteStreamsRef.current[p.userId];
            if (el && stream && el.srcObject !== stream) el.srcObject = stream;
          }}
          style={{ display: 'none' }}
        />
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{channel.name}</span>
      </div>

      {participants.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center', maxWidth: 480 }}>
          {participants.map(p => (
            <div key={p.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 76 }}>
              <div style={{ position: 'relative' }}>
                <UserAvatar src={p.avatarUrl} name={p.name} size={56} />
                {p.muted && (
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--bg-card)', border: '2px solid var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e06060',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {String(p.userId) === String(currentUserId) ? 'You' : p.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {participants.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No one's here yet.</div>
      )}

      {error && <div style={{ fontSize: 12.5, color: '#e06060' }}>{error}</div>}

      {!selfInRoom ? (
        <button
          onClick={handleJoin}
          disabled={connecting}
          style={{
            padding: '10px 28px', borderRadius: 24, border: 'none', background: 'var(--accent)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: connecting ? 'default' : 'pointer',
            opacity: connecting ? 0.7 : 1,
          }}
        >
          {connecting ? 'Joining…' : 'Join Voice'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={toggleMute}
            title={muted ? 'Unmute' : 'Mute'}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-input)',
              background: muted ? 'rgba(224,96,96,0.12)' : 'var(--bg-hover)', color: muted ? '#e06060' : 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {muted
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>}
          </button>
          <button
            onClick={handleLeave}
            title="Leave"
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: '#e06060', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
