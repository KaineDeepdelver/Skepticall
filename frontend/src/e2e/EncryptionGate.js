import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useE2EE } from './E2EEContext';
import './e2e.css';

function errorText(e) {
  const raw = (e && (e.message || e.code)) || 'Something went wrong';
  try { const j = JSON.parse(raw); return j.message || raw; } catch { return raw; }
}

const BACKUP_ERRORS = {
  WRONG_PASSPHRASE_OR_CORRUPT: 'Wrong passphrase, or the file is damaged.',
  WRONG_ACCOUNT: 'That backup belongs to a different account.',
  KEYS_NO_LONGER_VALID: 'That backup is too old: its keys were replaced more than 30 days ago.',
  BAD_FORMAT: 'That is not a Skepticall backup file.',
  UNSUPPORTED_VERSION: 'That backup was made by a newer version of the app.',
};

/**
 * Full-screen prompt shown when this browser can't use encryption yet:
 * the account has no key, or the key isn't on this browser.
 */
export function EncryptionGate() {
  const { service, status, notice } = useE2EE();
  const { user, logout } = useAuth();
  const fileRef = useRef(null);
  const [passphrase, setPassphrase] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user || (status !== 'needs-setup' && status !== 'needs-restore')) return null;

  async function run(fn) {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(BACKUP_ERRORS[e && e.code] || errorText(e)); }
    setBusy(false);
  }

  const createKey = (e) => {
    e.preventDefault();
    if (!password) { setError('Enter your account password to continue.'); return; }
    run(async () => { await service.createNewKey(password); setPassword(''); });
  };

  const restore = (e) => {
    e.preventDefault();
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) { setError('Choose your backup file first.'); return; }
    if (!passphrase) { setError('Enter the backup passphrase.'); return; }
    run(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await service.restoreFromBackup({ bytes, passphrase });
      setPassphrase('');
    });
  };

  const setup = status === 'needs-setup';

  return (
    <div className="e2e-overlay" role="dialog" aria-modal="true" aria-labelledby="e2e-title">
      <div className="e2e-card">
        <h2 id="e2e-title">{setup ? 'Turn on end-to-end encryption' : 'Unlock your messages on this browser'}</h2>

        {setup ? (
          <>
            <p>
              Messages are always end-to-end encrypted. Your account doesn’t have an encryption key yet, so
              this creates one that stays on this browser. Only you and the people you talk to can read your messages.
            </p>
            <form onSubmit={createKey}>
              <label>Account password
                <input type="password" value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)} disabled={busy} />
              </label>
              <button className="e2e-btn e2e-btn--primary" disabled={busy}>Turn on encryption</button>
            </form>
            <button className="e2e-link" onClick={logout} disabled={busy}>Log out</button>
          </>
        ) : (
          <>
            <p>
              Your messages are encrypted, and the key that unlocks them isn’t on this browser.
              {notice === 'old-keys-only' && ' That backup only held an older key: it opens older messages, but you need a new key to receive new ones.'}
            </p>

            {notice !== 'old-keys-only' && (
              <form onSubmit={restore} className="e2e-section">
                <h3>Restore from a key backup</h3>
                <label>Backup file (.dat)
                  <input type="file" accept=".dat" ref={fileRef} disabled={busy} />
                </label>
                <label>Backup passphrase
                  <input type="password" value={passphrase} autoComplete="off"
                    onChange={(e) => setPassphrase(e.target.value)} disabled={busy} />
                </label>
                <button className="e2e-btn e2e-btn--primary" disabled={busy}>Restore my key</button>
              </form>
            )}

            <form onSubmit={createKey} className="e2e-section">
              <h3>{notice === 'old-keys-only' ? 'Create a new key' : 'Or start fresh on this browser'}</h3>
              <p className="e2e-warn">
                A new key replaces your current one. Other devices that still use the old key can read new
                messages only until that key expires (30 days), and messages you can’t decrypt now stay locked.
              </p>
              <label>Account password
                <input type="password" value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)} disabled={busy} />
              </label>
              <button className="e2e-btn" disabled={busy}>Create a new key</button>
            </form>
            <button className="e2e-link" onClick={logout} disabled={busy}>Log out</button>
          </>
        )}

        {error && <p className="e2e-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

/** Settings button: downloads a passphrase-protected backup of this browser's key. */
export function KeyBackupButton() {
  const { service, status } = useE2EE();
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status !== 'ready') {
    return <span className="setting-desc">Not available</span>;
  }

  async function download(e) {
    e.preventDefault();
    if (passphrase.length < 8) { setError('Use at least 8 characters.'); return; }
    if (passphrase !== again) { setError('The passphrases don’t match.'); return; }
    setBusy(true);
    setError('');
    try {
      // Argon2 takes a moment: let the button state paint first.
      await new Promise((r) => setTimeout(r, 30));
      const bytes = service.exportKeyBackup(passphrase);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      a.download = `skepticall-key-backup-${new Date().toISOString().slice(0, 10)}.dat`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setOpen(false); setPassphrase(''); setAgain('');
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  if (!open) return <button className="e2e-btn" onClick={() => setOpen(true)}>Download backup</button>;
  return (
    <form onSubmit={download} className="e2e-inline">
      <input type="password" placeholder="Choose a passphrase" value={passphrase} autoComplete="new-password"
        onChange={(e) => setPassphrase(e.target.value)} disabled={busy} />
      <input type="password" placeholder="Repeat it" value={again} autoComplete="new-password"
        onChange={(e) => setAgain(e.target.value)} disabled={busy} />
      <button className="e2e-btn e2e-btn--primary" disabled={busy}>{busy ? 'Working…' : 'Download'}</button>
      <button type="button" className="e2e-btn" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      {error && <span className="e2e-error">{error}</span>}
    </form>
  );
}
