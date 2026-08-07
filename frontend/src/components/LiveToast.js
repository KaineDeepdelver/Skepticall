import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useWS } from '../context/WebSocketContext';
import { API_BASE } from '../services/api';
import { useLocation, useNavigate } from 'react-router-dom';

// Module-level — persists until user visits /messages
const msgCounts = {};

function getAvatar(src) {
  if (!src) return null;
  return src.startsWith('http') ? src : `${API_BASE}${src}`;
}

function ToastBubble({ text, avatar, name, count, onClick }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(16,16,18,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 50,
        padding: '8px 14px 8px 8px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)',
        maxWidth: 340,
        minWidth: 180,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* avatar with count badge */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {avatar
          ? <img src={avatar} alt={name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {initials}
            </div>
        }
        {count > 1 && (
          <div style={{
            position: 'absolute', bottom: -3, right: -3,
            background: '#4facfe',
            color: '#fff',
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 700,
            minWidth: 17,
            height: 17,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            border: '2px solid rgba(16,16,18,0.97)',
            lineHeight: 1,
          }}>{count > 99 ? '99+' : count}</div>
        )}
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#f0f0f0',
          lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.5)',
          marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {text}
        </div>
      </div>

      {/* chevron */}
      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" width="13" height="13" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

export default function LiveToast({ userId, conversations = [] }) {
  const ws      = useWS();
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const toastIds     = useRef({});
  const prevPath     = useRef(pathname);

  // Clear accumulated counts when user goes to /messages
  useEffect(() => {
    if (pathname === '/messages' && prevPath.current !== '/messages') {
      Object.keys(msgCounts).forEach(k => delete msgCounts[k]);
      Object.keys(toastIds.current).forEach(k => delete toastIds.current[k]);
    }
    prevPath.current = pathname;
  }, [pathname]);

  const handleMsg = useCallback((msg) => {
    if (msg.senderId === userId) return;
    const msgType = msg._type || msg.type || '';
    // Drop all call signaling — handled by CallScreen
    if (msgType.startsWith('CALL_')) return;
    if (msg._type && msg._type !== 'MSG') return;
    if (pathname === '/messages') return;

    const senderId = msg.senderId || msg.actorId;
    const convo    = conversations.find(c => c.userId === senderId);
    const name     = convo?.name || msg.senderName || 'Someone';
    const avatar   = getAvatar(convo?.avatar || msg.senderAvatar);
    const type     = msg._type === 'CALL_OFFER' ? 'CALL' : (msg.type || 'TEXT');

    let bodyText;
    let stackKey;

    switch (type) {
      case 'VOICE':
        stackKey = `${senderId}_VOICE`;
        msgCounts[stackKey] = (msgCounts[stackKey] || 0) + 1;
        bodyText = msgCounts[stackKey] > 1
          ? `${msgCounts[stackKey]} voice messages`
          : 'Sent a voice message';
        break;
      default:
        if (msg.replyToId) {
          bodyText = 'Replied to your message';
          stackKey = null;
        } else {
          stackKey = `${senderId}_MSG`;
          msgCounts[stackKey] = (msgCounts[stackKey] || 0) + 1;
          bodyText = msgCounts[stackKey] > 1
            ? `${msgCounts[stackKey]} new messages`
            : 'Sent a message';
        }
        break;
    }

    const count = stackKey ? (msgCounts[stackKey] || 1) : 1;

    // Dismiss old stacked toast so the new one replaces it
    const existing = stackKey ? toastIds.current[stackKey] : null;
    if (existing) toast.dismiss(existing);

    // Capture navigate in closure for the onClick
    const goToMessages = () => navigate('/messages');

    const id = toast.custom(
      (t) => (
        <ToastBubble
          text={bodyText}
          avatar={avatar}
          name={name}
          count={count}
          onClick={() => {
            toast.dismiss(t.id);
            // Reset this sender's count on click
            if (stackKey) {
              delete msgCounts[stackKey];
              delete toastIds.current[stackKey];
            }
            goToMessages();
          }}
        />
      ),
      { duration: 5000, position: 'top-center' }
    );

    if (stackKey) {
      toastIds.current[stackKey] = id;
      // Do NOT reset msgCounts on expiry — count persists until /messages is visited
    }
  }, [userId, pathname, conversations, navigate]);

  useEffect(() => {
    if (!ws || !userId) return;
    return ws.subscribe(handleMsg);
  }, [ws, userId, handleMsg]);

  return null;
}