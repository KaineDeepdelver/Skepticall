import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { restoreSession, endRememberedSession } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('omni_user')); } catch { return null; }
  });

  // Guest mode: browsing without an account — can view public content
  // (posts, videos, profiles) but can't like/comment/message/etc.
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem('omni_guest') === 'true');

  const continueAsGuest = useCallback(() => {
    sessionStorage.setItem('omni_guest', 'true');
    setIsGuest(true);
  }, []);

  const exitGuest = useCallback(() => {
    sessionStorage.removeItem('omni_guest');
    setIsGuest(false);
  }, []);

  // Called after login or register — receives the { token, user } response
  const login = useCallback((responseData) => {
    const userData = responseData.user ?? responseData; // backward-compatible fallback
    const token    = responseData.token ?? null;

    sessionStorage.removeItem('omni_guest');
    setIsGuest(false);

    sessionStorage.setItem('omni_user', JSON.stringify(userData));
    sessionStorage.setItem('omni_user_id', String(userData.id));
    if (token) sessionStorage.setItem('omni_token', token);

    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    endRememberedSession();   // forget this browser too, or the cookie would just log you back in
    sessionStorage.clear();
    setUser(null);
    setIsGuest(false);
  }, []);

  // Remember-me: a fresh tab (or a restart) has no sessionStorage, so ask the
  // backend to restore the login from the HttpOnly cookie before deciding the
  // user is logged out. Guests who chose to stay guests are left alone.
  const [restoring, setRestoring] = useState(
    () => !sessionStorage.getItem('omni_user') && sessionStorage.getItem('omni_guest') !== 'true'
  );
  const restoreRef = useRef(null);       // shared in-flight restore
  const lastRestoreRef = useRef(0);

  const tryRestore = useCallback(() => {
    if (!restoreRef.current) {
      lastRestoreRef.current = Date.now();
      restoreRef.current = restoreSession().finally(() => { restoreRef.current = null; });
    }
    return restoreRef.current;
  }, []);

  useEffect(() => {
    if (!restoring) return;
    tryRestore().then(login).catch(() => {}).finally(() => setRestoring(false));
  }, [restoring, tryRestore, login]);

  // If api.js detects a missing/invalid token (401, or 403 with no token
  // present), sessionStorage has already been cleared there. Try the
  // remember-me cookie once for a fresh token; only if that fails do we sync
  // React state so the UI stops pretending we're still logged in.
  useEffect(() => {
    const onAuthExpired = () => {
      if (!restoreRef.current && Date.now() - lastRestoreRef.current < 10000) { setUser(null); return; }
      tryRestore().then(login).catch(() => setUser(null));
    };
    window.addEventListener('omni:auth-expired', onAuthExpired);
    return () => window.removeEventListener('omni:auth-expired', onAuthExpired);
  }, [tryRestore, login]);

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      sessionStorage.setItem('omni_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Hold the first render until the cookie check finishes, otherwise a remembered
  // user would be bounced to the login page for a moment.
  if (restoring) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isGuest, continueAsGuest, exitGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
