import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useE2EE } from './E2EEContext';
import RecoveryDialog from './RecoveryDialog';

const VaultContext = createContext(null);

/**
 * Tracks whether the account has a recovery-phrase backup of its key, and owns the dialog that makes one.
 * Status: 'unknown' (not checked / not signed in), 'none', 'current', 'stale' (made before the latest key
 * change), or 'error' (could not ask the server).
 */
export function VaultProvider({ children }) {
  const { user } = useAuth();
  const { service, status, version } = useE2EE();
  const [vault, setVault] = useState('unknown');
  const [dialog, setDialog] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const prompted = useRef(false);

  const refresh = useCallback(async () => {
    try { setVault(await service.vaultStatus()); } catch { setVault('error'); }
  }, [service]);

  useEffect(() => {
    if (user && status === 'ready') refresh();
    else setVault('unknown');
  }, [user && user.id, status, version, refresh]);

  // A key made a moment ago has no backup yet: ask for one straight away, once per page load.
  useEffect(() => {
    if (vault === 'none' && service.getState().freshKey && !prompted.current) {
      prompted.current = true;
      setDialog(true);
    }
  }, [vault, service]);

  const value = useMemo(() => ({
    vault,
    refresh,
    openDialog: () => setDialog(true),
    bannerVisible: (vault === 'none' || vault === 'stale') && !bannerHidden,
    hideBanner: () => setBannerHidden(true),
  }), [vault, refresh, bannerHidden]);

  return (
    <VaultContext.Provider value={value}>
      {children}
      {dialog && (
        <RecoveryDialog
          replacing={vault === 'current' || vault === 'stale'}
          onClose={() => setDialog(false)}
          onDone={refresh}
        />
      )}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>');
  return ctx;
}

/** Settings row content: where the recovery phrase stands, and the button to make or replace it. */
export function RecoveryPhraseControl() {
  const { status } = useE2EE();
  const { vault, openDialog } = useVault();
  if (status !== 'ready') return <span className="setting-desc">Not available</span>;
  const label = { none: 'Not set up', current: 'Active', stale: 'Out of date', error: 'Could not check', unknown: 'Checking…' }[vault];
  return (
    <div className="rec-setting">
      <span className={`rec-status rec-status--${vault}`}>{label}</span>
      <button className="e2e-btn e2e-btn--primary" onClick={openDialog} disabled={vault === 'unknown'}>
        {vault === 'none' ? 'Set up' : 'Make a new phrase'}
      </button>
    </div>
  );
}

/** A reminder across the top of the app until a recovery phrase is set up. */
export function VaultBanner() {
  const { bannerVisible, vault, openDialog, hideBanner } = useVault();
  if (!bannerVisible) return null;
  return (
    <div className="rec-banner" role="region" aria-label="Recovery phrase">
      <p>
        {vault === 'stale'
          ? 'Your recovery phrase is out of date because your key changed. Make a new one so a new device can unlock your messages.'
          : 'Protect your messages: save a recovery phrase so you can unlock them on any device. Without one, a new browser can’t read your history.'}
      </p>
      <div className="rec-banner-actions">
        <button className="e2e-btn e2e-btn--primary" onClick={openDialog}>{vault === 'stale' ? 'Update' : 'Set up'}</button>
        <button className="e2e-link" onClick={hideBanner}>Not now</button>
      </div>
    </div>
  );
}
