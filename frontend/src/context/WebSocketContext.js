import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { API_BASE } from '../services/api';
import { useAuth } from './AuthContext';
import SockJS from 'sockjs-client';

const WebSocketContext = createContext(null);

// Build a wss:// or ws:// STOMP broker URL.
// Spring's SockJS endpoint exposes a raw WebSocket at /ws/websocket.
// We derive it from API_BASE so it automatically upgrades to wss:// when
// the page is served over HTTPS (Cloudflare tunnel, ngrok, etc.)
function getWsUrl() {
  const base = API_BASE
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:');
  return `${base}/ws/websocket`;
}

export function WebSocketProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;

  const clientRef = useRef(null);
  const listenersRef = useRef(new Set());
  // Track active group subscriptions so we don't double-subscribe
  const groupSubsRef = useRef({}); // groupId -> STOMP subscription object
  const pendingGroupsRef = useRef(new Set()); // groupIds requested before connect
  // Same pattern, for network channels (/topic/channel/{id}) — separate
  // namespace from groups since channel ids and group ids aren't unique
  // across each other.
  const channelSubsRef = useRef({});
  const pendingChannelsRef = useRef(new Set());

  const publish = useCallback((destination, body) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({ destination, body: JSON.stringify(body) });
    }
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  // == Subscribe to a group topic ==
  const subscribeToGroup = useCallback((groupId) => {
    if (!groupId) return;
    const id = String(groupId);
    if (groupSubsRef.current[id]) return; // already subscribed

    if (clientRef.current?.connected) {
      const sub = clientRef.current.subscribe(`/topic/group/${id}`, frame => {
        try {
          const msg = JSON.parse(frame.body);
          listenersRef.current.forEach(fn => fn(msg));
        } catch { }
      });
      groupSubsRef.current[id] = sub;
    } else {
      // Queue it; will be flushed on connect
      pendingGroupsRef.current.add(id);
    }
  }, []);

  // == Subscribe to a network channel topic ==
  const subscribeToChannel = useCallback((channelId) => {
    if (!channelId) return;
    const id = String(channelId);
    if (channelSubsRef.current[id]) return; // already subscribed

    if (clientRef.current?.connected) {
      const sub = clientRef.current.subscribe(`/topic/channel/${id}`, frame => {
        try {
          const msg = JSON.parse(frame.body);
          listenersRef.current.forEach(fn => fn(msg));
        } catch { }
      });
      channelSubsRef.current[id] = sub;
    } else {
      pendingChannelsRef.current.add(id);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    // No early-return if token is missing at mount time — beforeConnect below
    // re-reads sessionStorage on every CONNECT attempt, so a token that arrives
    // later (or gets refreshed) will be picked up on the next reconnect.

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE}/ws`),
      reconnectDelay: 5000,
      beforeConnect: () => {
        const token = sessionStorage.getItem('omni_token');
        client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onConnect() {
        // DM + presence topics
        client.subscribe(`/topic/messages/${userId}`, frame => {
          try {
            const msg = JSON.parse(frame.body);
            listenersRef.current.forEach(fn => fn(msg));
          } catch { }
        });
        client.subscribe(`/topic/presence`, frame => {
          try {
            const msg = { _type: 'PRESENCE', ...JSON.parse(frame.body) };
            listenersRef.current.forEach(fn => fn(msg));
          } catch { }
        });
        // userId no longer sent — the server reads it from the authenticated
        // STOMP session instead of trusting the payload
        client.publish({ destination: '/app/presence', body: JSON.stringify({ online: true }) });

        // Re-subscribe to any groups that were queued or already known
        const allPending = new Set([
          ...pendingGroupsRef.current,
          ...Object.keys(groupSubsRef.current),
        ]);
        groupSubsRef.current = {};
        pendingGroupsRef.current.clear();
        allPending.forEach(id => {
          const sub = client.subscribe(`/topic/group/${id}`, frame => {
            try {
              const msg = JSON.parse(frame.body);
              listenersRef.current.forEach(fn => fn(msg));
            } catch { }
          });
          groupSubsRef.current[id] = sub;
        });

        // Same for channels
        const allPendingChannels = new Set([
          ...pendingChannelsRef.current,
          ...Object.keys(channelSubsRef.current),
        ]);
        channelSubsRef.current = {};
        pendingChannelsRef.current.clear();
        allPendingChannels.forEach(id => {
          const sub = client.subscribe(`/topic/channel/${id}`, frame => {
            try {
              const msg = JSON.parse(frame.body);
              listenersRef.current.forEach(fn => fn(msg));
            } catch { }
          });
          channelSubsRef.current[id] = sub;
        });
      },
    });
    client.activate();
    clientRef.current = client;
    return () => {
      client.deactivate();
      clientRef.current = null;
      groupSubsRef.current = {};
      channelSubsRef.current = {};
    };
  }, [userId]);

  return (
    <WebSocketContext.Provider value={{ publish, subscribe, subscribeToGroup, subscribeToChannel }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWS() {
  return useContext(WebSocketContext);
}
