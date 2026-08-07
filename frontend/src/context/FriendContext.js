import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { friendApi } from '../services/api';
import { useAuth } from './AuthContext';

const FriendContext = createContext({ friendIds: new Set(), isFriend: () => false, refresh: () => {} });

export function FriendProvider({ children }) {
  const { user } = useAuth();
  const [friendIds, setFriendIds] = useState(new Set());

  const load = useCallback(async () => {
    if (!user?.id) { setFriendIds(new Set()); return; }
    try {
      const list = await friendApi.list(user.id);
      setFriendIds(new Set(list.map(f => f.userId)));
    } catch {
      setFriendIds(new Set());
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const isFriend = useCallback((userId) => {
    if (!userId || !user?.id || userId === user.id) return false;
    return friendIds.has(Number(userId));
  }, [friendIds, user?.id]);

  return (
    <FriendContext.Provider value={{ friendIds, isFriend, refresh: load }}>
      {children}
    </FriendContext.Provider>
  );
}

export const useFriends = () => useContext(FriendContext);
