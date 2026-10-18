import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LegalLayout from '../legal/LegalLayout';
import { api } from '../services/api';

/** The one-click link at the bottom of optional emails (new sign-in alerts). */
export default function EmailPreferencesPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState('idle');

  async function turnOff() {
    setState('working');
    try { await api.unsubscribeAlerts(token); setState('done'); } catch { setState('error'); }
  }

  return (
    <LegalLayout title="Email preferences" showUpdated={false}>
      {!token && <p className="lg-err">This link is missing its token. You can change email alerts in <strong>Settings → Security</strong>.</p>}
      {token && state !== 'done' && (
        <div className="lg-card">
          <h2>Turn off new sign-in alert emails?</h2>
          <p>You’ll stop getting an email when your account is signed in from a new network. You can turn it back on in Settings.</p>
          <button type="button" className="lg-btn lg-btn--primary" onClick={turnOff} disabled={state === 'working'}>
            {state === 'working' ? 'Working…' : 'Turn off these emails'}
          </button>
          {state === 'error' && <p className="lg-err" role="alert">That link is invalid or has expired. Use Settings → Security instead.</p>}
        </div>
      )}
      {state === 'done' && <div className="lg-card" role="status"><p className="lg-ok">Done. You won’t get new sign-in alert emails any more.</p></div>}
      <p>
        We still send account emails you need, such as verification codes and password resets. They can’t be switched off. Read more in
        our <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>
    </LegalLayout>
  );
}
