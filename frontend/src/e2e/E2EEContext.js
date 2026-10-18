import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, resolveUrl, API_BASE } from '../services/api';
import { createE2EE } from './e2eeService';
import { createKeyStore } from './keyStore';

const E2EEContext = createContext(null);

// One key store for the whole app (sign-up also writes to it).
export const keyStore = createKeyStore();

function absoluteFileUrl(url) {
  return resolveUrl(url.startsWith('http') ? url : `${API_BASE}${url}`);
}

/** Wraps the app: keeps the encryption service in sync with who is logged in. */
export function E2EEProvider({ children }) {
  const { user } = useAuth();
  const service = useMemo(
    () => createE2EE({ store: keyStore, api, resolveFileUrl: absoluteFileUrl }),
    []
  );
  const [snap, setSnap] = useState(service.getState());

  useEffect(() => service.subscribe(setSnap), [service]);
  useEffect(() => {
    if (user) service.init(user).catch((e) => console.error('[e2ee] init failed:', e));
    else service.reset();
  }, [user?.id, service]);

  const value = useMemo(
    () => ({ service, status: snap.status, version: snap.version, notice: snap.notice }),
    [service, snap.status, snap.version, snap.notice]
  );
  return <E2EEContext.Provider value={value}>{children}</E2EEContext.Provider>;
}

export function useE2EE() {
  const ctx = useContext(E2EEContext);
  if (!ctx) throw new Error('useE2EE must be used inside <E2EEProvider>');
  return ctx;
}
