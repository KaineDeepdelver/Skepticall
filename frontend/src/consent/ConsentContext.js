import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Cookie / third-party consent.
 *
 * Strictly necessary storage (staying signed in, your settings, your encryption keys) needs no
 * consent. The only optional thing is Google reCAPTCHA on the sign-up form: it sets Google cookies
 * and sends your IP address to Google, so it only loads after "Accept" (or by turning it on in the
 * settings). The choice is remembered, and can be changed at any time from "Cookie settings".
 */
const STORAGE_KEY = 'skepticall_consent';
const ConsentContext = createContext(null);

function readStored() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return v && v.v === 1 ? v : null;
  } catch {
    return null;
  }
}

export function ConsentProvider({ children }) {
  const [stored, setStored] = useState(readStored);
  const [panelRequested, setPanelRequested] = useState(false);

  const save = useCallback((google) => {
    const value = { v: 1, google: !!google, at: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* private mode: keep it in memory */ }
    setStored(value);
    setPanelRequested(false);
  }, []);

  const value = useMemo(() => ({
    decided: !!stored,
    google: !!(stored && stored.google),
    acceptAll: () => save(true),
    rejectOptional: () => save(false),
    setGoogle: save,
    reopen: () => setPanelRequested(true),
    close: () => setPanelRequested(false),
    panelOpen: !stored || panelRequested,
  }), [stored, panelRequested, save]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used inside <ConsentProvider>');
  return ctx;
}
