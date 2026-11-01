import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { blockApi } from '../services/api';
import { useAuth } from './AuthContext';

const BlockContext = createContext(null);

/**
 * The people the signed-in person has blocked. The server is what stops a blocked person messaging, calling
 * or sending friend requests; this lets the app also hide them (their chat, their messages in groups).
 */
export function BlockProvider({ children }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) { setBlocked([]); return; }
    try {
      const list = await blockApi.list();
      // Anything other than a list (an older server, an error body) means "nobody is blocked", never a crash.
      setBlocked(Array.isArray(list) ? list : []);
    } catch { /* keep what we had */ }
  }, [user && user.id]); // eslint-disable-line

  useEffect(() => { refresh(); }, [refresh]);

  const blockedIds = useMemo(() => new Set(blocked.map((b) => Number(b.userId))), [blocked]);

  const value = useMemo(() => ({
    blocked,
    blockedIds,
    isBlocked: (id) => blockedIds.has(Number(id)),
    async block(id) { await blockApi.block(id); await refresh(); },
    async unblock(id) { await blockApi.unblock(id); await refresh(); },
    refresh,
  }), [blocked, blockedIds, refresh]);

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlocks() {
  const ctx = useContext(BlockContext);
  if (!ctx) throw new Error('useBlocks must be used inside <BlockProvider>');
  return ctx;
}
