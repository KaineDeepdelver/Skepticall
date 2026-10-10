import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import UserAvatar from './UserAvatar';

const PhoneIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.39 18a19.5 19.5 0 0 1-3.39-3.39A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const VideoIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const ArrowIcon = ({ out }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12" style={{ transform: out ? 'none' : 'rotate(180deg)' }}>
    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
  </svg>
);

function fmtDuration(sec) {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const diff = Math.floor((now - d) / 86400000);
  if (diff < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

// What the row says, from the viewer's side of the call.
function describe(call, outgoing) {
  switch (call.callStatus) {
    case 'completed': return { text: `${outgoing ? 'Outgoing' : 'Incoming'}${call.callDurationSeconds != null ? ' · ' + fmtDuration(call.callDurationSeconds) : ''}`, bad: false };
    case 'declined':  return { text: outgoing ? 'Declined' : 'You declined', bad: false };
    case 'missed':    return outgoing ? { text: 'No answer', bad: false } : { text: 'Missed', bad: true };
    case 'cancelled': return outgoing ? { text: 'Cancelled', bad: false } : { text: 'Missed', bad: true };
    default:          return { text: outgoing ? 'Outgoing' : 'Incoming', bad: false };
  }
}

export default function CallLogList({ userId, conversations, onCall }) {
  const [calls, setCalls]     = useState(null);
  const [people, setPeople]   = useState({});   // otherId -> { name, avatar, username }

  useEffect(() => {
    let alive = true;
    api.getCallLog(userId)
      .then(list => { if (alive) setCalls(list || []); })
      .catch(() => { if (alive) setCalls([]); });
    return () => { alive = false; };
  }, [userId]);

  // Names/avatars: conversations first, then look up anyone not in them.
  useEffect(() => {
    if (!calls) return;
    const known = {};
    conversations.forEach(c => { if (!c.isGroup) known[c.userId] = { name: c.name || c.username, avatar: c.avatar, username: c.username }; });
    const missing = [...new Set(calls.map(c => Number(c.senderId) === Number(userId) ? c.receiverId : c.senderId))]
      .filter(id => !known[id]);
    setPeople(known);
    missing.forEach(id => {
      api.getUser(id)
        .then(u => setPeople(prev => ({ ...prev, [id]: { name: u.displayName || u.username, avatar: u.profilePicture, username: u.username } })))
        .catch(() => {});
    });
  }, [calls, conversations, userId]);

  if (calls === null) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>;
  if (calls.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No calls yet</div>;

  return calls.map(call => {
    const outgoing = Number(call.senderId) === Number(userId);
    const otherId  = outgoing ? call.receiverId : call.senderId;
    const p        = people[otherId] || {};
    const name     = p.name || 'Unknown';
    const video    = call.callMode === 'video';
    const { text, bad } = describe(call, outgoing);
    return (
      <div key={call.id} className="convo-item" style={{ cursor: 'default' }}>
        <UserAvatar src={p.avatar} name={name} userId={otherId} size={44} />
        <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: bad ? '#e0475f' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: bad ? '#e0475f' : 'var(--text-muted)', marginTop: 2 }}>
            <ArrowIcon out={outgoing} />
            <span>{video ? 'Video' : 'Voice'} · {text}</span>
            <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{fmtWhen(call.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={() => onCall(video ? 'video' : 'audio', { userId: otherId, name, avatar: p.avatar || null, username: p.username })}
          aria-label={`Call ${name} back`}
          style={{ marginLeft: 10, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--bg-hover)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {video ? <VideoIcon /> : <PhoneIcon />}
        </button>
      </div>
    );
  });
}
