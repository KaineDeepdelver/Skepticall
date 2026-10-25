import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsent } from './ConsentContext';
import './consent.css';

/**
 * First-visit banner and the "Cookie settings" panel. Accept and Reject are the same size and
 * style on purpose: saying no must be exactly as easy as saying yes.
 */
export default function CookieBanner() {
  const { panelOpen, decided, google, acceptAll, rejectOptional, setGoogle, close, saveFailed, dismissSaveFailed } = useConsent();
  const [custom, setCustom] = useState(false);
  const [googleChoice, setGoogleChoice] = useState(google);
  const firstButton = useRef(null);

  useEffect(() => { setGoogleChoice(google); }, [google, panelOpen]);
  useEffect(() => { if (panelOpen && decided && firstButton.current) firstButton.current.focus(); }, [panelOpen, decided]);
  useEffect(() => {
    if (!panelOpen || !decided) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, decided, close]);

  if (!panelOpen && saveFailed) {
    return (
      <section className="cb" role="status" aria-live="polite" aria-labelledby="cb-warn-title">
        <h2 id="cb-warn-title">Your browser isn’t keeping this choice</h2>
        <p>
          Private browsing, blocked site data, or a setting that clears data when you close the browser stops us
          remembering your choice, and keeping you signed in, between visits. You will be asked again next time.
          Use a normal window and allow site data for this site to make it stick.
        </p>
        <div className="cb-actions"><button type="button" className="cb-btn" onClick={dismissSaveFailed}>Got it</button></div>
      </section>
    );
  }
  if (!panelOpen) return null;

  return (
    <section className="cb" role="dialog" aria-modal="false" aria-labelledby="cb-title">
      <h2 id="cb-title">Your privacy choices</h2>
      <p>
        Skepticall uses a few small files in your browser to keep you signed in and remember your settings. These are
        essential and always on. We don’t use advertising or analytics cookies. The sign-up form can also use Google
        reCAPTCHA to block spam, which sets Google cookies and shares your IP address with Google. It only loads if you allow it.{' '}
        <Link to="/cookie-policy">Cookie Policy</Link> · <Link to="/privacy-policy">Privacy Policy</Link>
      </p>

      {custom && (
        <div className="cb-options">
          <label className="cb-row">
            <input type="checkbox" checked disabled />
            <span><strong>Essential</strong><small>Sign-in, settings and your encryption keys. Needed for the service to work.</small></span>
          </label>
          <label className="cb-row">
            <input type="checkbox" checked={googleChoice} onChange={(e) => setGoogleChoice(e.target.checked)} />
            <span><strong>Google reCAPTCHA</strong><small>Spam protection on the sign-up form. Google receives your IP address and browser details.</small></span>
          </label>
        </div>
      )}

      <div className="cb-actions">
        <button type="button" className="cb-btn" onClick={acceptAll} ref={firstButton}>Accept all</button>
        <button type="button" className="cb-btn" onClick={rejectOptional}>Reject non-essential</button>
        {custom
          ? <button type="button" className="cb-btn" onClick={() => setGoogle(googleChoice)}>Save my choices</button>
          : <button type="button" className="cb-btn cb-btn--quiet" onClick={() => setCustom(true)}>Customize</button>}
        {decided && <button type="button" className="cb-btn cb-btn--quiet" onClick={close}>Close</button>}
      </div>
    </section>
  );
}
