import { useEffect, useRef } from 'react';
import { useWS } from '../context/WebSocketContext';

export function useWebSocket(userId, onMessage) {
  const ws = useWS();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!ws || !userId) return;
    const unsub = ws.subscribe(msg => {
      try { onMessageRef.current(msg); } catch {}
    });
    return unsub;
  }, [ws, userId]);

  return {
    publish: ws?.publish ?? (() => {}),
    subscribeToGroup: ws?.subscribeToGroup ?? (() => {}),
    subscribeToChannel: ws?.subscribeToChannel ?? (() => {}),
  };
}
