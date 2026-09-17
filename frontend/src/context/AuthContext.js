import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

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
    sessionStorage.clear();
    setUser(null);
    setIsGuest(false);
  }, []);

  // If api.js detects a missing/invalid token (401, or 403 with no token
  // present), sessionStorage has already been cleared there — sync React
  // state so the UI stops pretending we're still logged in.
  useEffect(() => {
    const onAuthExpired = () => setUser(null);
    window.addEventListener('omni:auth-expired', onAuthExpired);
    return () => window.removeEventListener('omni:auth-expired', onAuthExpired);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      sessionStorage.setItem('omni_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isGuest, continueAsGuest, exitGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
