import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useE2EE } from './E2EEContext';
import Spinner from '../components/Spinner';
import { generatePhrase, phraseWords, confirmationPositions, confirmationMatches } from './recoveryPhrase';
import './recovery.css';

function errorText(e) {
  const raw = (e && (e.message || e.code)) || 'Something went wrong';
  try { const j = JSON.parse(raw); return j.message || raw; } catch { return raw; }
}

const ordinal = (n) => `word ${n + 1}`;

/**
 * Makes a recovery phrase, makes the person prove they saved it, then locks the account's key with it.
 * The phrase is made and used only in this browser; the server receives the locked backup.
 */
export default function RecoveryDialog({ onClose, onDone, replacing = false }) {
  const { service } = useE2EE();
  const [phrase, setPhrase] = useState('');
  const [step, setStep] = useState('show');           // show -> confirm -> save -> done
  const [saved, setSaved] = useState(false);
  const [answers, setAnswers] = useState({});
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const first = useRef(null);

  useEffect(() => { generatePhrase().then(setPhrase); }, []);
  const positions = useMemo(() => confirmationPositions(), []);
  const words = phraseWords(phrase);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && step !== 'done' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step, busy]);
  useEffect(() => { if (first.current) first.current.focus(); }, [step, phrase]);

  async function copy() {
    try { await navigator.clipboard.writeText(phrase); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the words are on screen */ }
  }

  function download() {
    const text = [
      'Skepticall recovery phrase',
      '',
      phrase,
      '',
      `Made ${new Date().toLocaleDateString()}.`,
      'Anyone with this phrase and access to your account can unlock your messages. Keep it somewhere safe and private.',
      'If you lose it you can make a new one while you are signed in, but messages you cannot unlock stay locked.',
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'skepticall-recovery-phrase.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function checkWords(e) {
    e.preventDefault();
    if (!confirmationMatches(phrase, answers)) { setError('Those words don’t match. Check your saved copy and try again.'); return; }
    setError(''); setStep('save');
  }

  async function save(e) {
    e.preventDefault();
    if (!password) { setError('Enter your account password to save the phrase.'); return; }
    setBusy(true); setError('');
    try {
      await service.saveVault({ phrase, password });
      setPassword('');
      setStep('done');
      if (onDone) onDone();
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  return (
    <div className="e2e-overlay rec-overlay" role="dialog" aria-modal="true" aria-labelledby="rec-title">
      <div className="e2e-card rec-card">
        {step === 'show' && (
          <>
            <h2 id="rec-title">{replacing ? 'Make a new recovery phrase' : 'Save your recovery phrase'}</h2>
            <p>
              These six words unlock your messages on any device. Write them down or save them somewhere safe.
              We can’t see them and can’t recover them for you.
              {replacing && ' This replaces your old phrase.'}
            </p>
            {phrase ? (
              <ol className="rec-words" aria-label="Your recovery phrase">
                {words.map((w, i) => <li key={i}><span>{i + 1}</span>{w}</li>)}
              </ol>
            ) : <div className="rec-loading"><Spinner /> Making your phrase…</div>}
            <div className="rec-actions">
              <button type="button" className="e2e-btn" onClick={copy} disabled={!phrase}>{copied ? 'Copied' : 'Copy'}</button>
              <button type="button" className="e2e-btn" onClick={download} disabled={!phrase}>Download</button>
            </div>
            <label className="rec-check">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} ref={first} />
              I saved my recovery phrase somewhere safe
            </label>
            <div className="rec-actions rec-actions--end">
              <button type="button" className="e2e-link" onClick={onClose}>Not now</button>
              <button type="button" className="e2e-btn e2e-btn--primary" disabled={!saved || !phrase} onClick={() => setStep('confirm')}>Continue</button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <form onSubmit={checkWords}>
            <h2 id="rec-title">Check your copy</h2>
            <p>Type these two words from your saved phrase to make sure you wrote it down correctly.</p>
            {positions.map((p, i) => (
              <label key={p}>Your {ordinal(p)}
                <input value={answers[p] || ''} ref={i === 0 ? first : null} autoComplete="off" autoCapitalize="none" spellCheck={false}
                  onChange={(e) => setAnswers({ ...answers, [p]: e.target.value })} />
              </label>
            ))}
            <div className="rec-actions rec-actions--end">
              <button type="button" className="e2e-link" onClick={() => { setStep('show'); setError(''); }}>Back</button>
              <button className="e2e-btn e2e-btn--primary">Continue</button>
            </div>
          </form>
        )}

        {step === 'save' && (
          <form onSubmit={save}>
            <h2 id="rec-title">Confirm it’s you</h2>
            <p>Enter your account password to lock your key with this phrase and store it on your account.</p>
            <label>Account password
              <input type="password" value={password} ref={first} autoComplete="current-password" disabled={busy}
                onChange={(e) => setPassword(e.target.value)} />
            </label>
            <div className="rec-actions rec-actions--end">
              <button type="button" className="e2e-link" onClick={() => { setStep('confirm'); setError(''); }} disabled={busy}>Back</button>
              <button className="e2e-btn e2e-btn--primary" disabled={busy}>{busy ? <><Spinner />Saving…</> : 'Save phrase'}</button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <>
            <h2 id="rec-title">Your recovery phrase is set up</h2>
            <p>On a new browser or device, log in and choose “Unlock with your recovery phrase”. Your messages will open there too.</p>
            <div className="rec-actions rec-actions--end">
              <button type="button" className="e2e-btn e2e-btn--primary" onClick={onClose} ref={first}>Done</button>
            </div>
          </>
        )}

        {error && <p className="e2e-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
