import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import CallLogList from '../components/CallLogList';

export default function Calls() {
  const { user } = useAuth();
  const { startCall } = useCall();
  const [conversations, setConversations] = useState([]);

  // Only used to show names/avatars without a lookup per caller.
  useEffect(() => {
    if (!user?.id) return;
    api.getConversations(user.id).then(setConversations).catch(() => {});
  }, [user?.id]);

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 10px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>Calls</div>
      <div className="convo-list" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 20px' }}>
        <CallLogList userId={user.id} conversations={conversations} onCall={startCall} />
      </div>
    </div>
  );
}
