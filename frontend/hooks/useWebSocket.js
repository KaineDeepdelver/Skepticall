import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_BASE } from '../services/api';

export function useWebSocket(userId, onMessage) {
  const clientRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Track active group subscriptions so we don't double-subscribe on reconnect
  const groupSubsRef = useRef({});

  const publish = useCallback((destination, body) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({ destination, body: JSON.stringify(body) });
    } else {
      // Stop gaslighting the user: throw an actual error if disconnected
      console.error("WebSocket is dead. Cannot publish to:", destination);
      throw new Error("WebSocket is disconnected. Please check your server/tunnel.");
    }
  }, []);

  const subscribeToGroup = useCallback((groupId) => {
    const client = clientRef.current;
    if (!client?.connected) return;
    if (groupSubsRef.current[groupId]) return; // already subscribed
    const sub = client.subscribe(`/topic/group/${groupId}`, frame => {
      try { onMessageRef.current(JSON.parse(frame.body)); } catch {}
    });
    groupSubsRef.current[groupId] = sub;
  }, []);

  useEffect(() => {
    if (!userId) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE}/ws`),
      reconnectDelay: 5000,
      onConnect() {
        // Clear stale subs — connection is fresh
        groupSubsRef.current = {};

        client.subscribe(`/topic/messages/${userId}`, frame => {
          try { onMessageRef.current(JSON.parse(frame.body)); } catch {}
        });
        client.subscribe(`/topic/presence`, frame => {
          try { onMessageRef.current({ _type: 'PRESENCE', ...JSON.parse(frame.body) }); } catch {}
        });
        client.publish({ destination: '/app/presence', body: JSON.stringify({ userId, online: true }) });
      },
    });
    client.activate();
    clientRef.current = client;
    return () => {
      groupSubsRef.current = {};
      client.deactivate();
    };
  }, [userId]);

  return { publish, subscribeToGroup };
}