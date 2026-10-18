import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { CookieSettingsButton } from '../legal/LegalLayout';

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy">
      <p>
        Cookies, and similar browser storage, are small pieces of data a website keeps in your browser. Skepticall uses them only to
        work and to remember your settings. We use <strong>no advertising or analytics cookies</strong>.
      </p>

      <h2>What we store</h2>
      <div className="lg-table-wrap">
        <table className="lg-table">
          <thead><tr><th>Name</th><th>Purpose</th><th>How long</th><th>Needs consent?</th></tr></thead>
          <tbody>
            <tr><td><code>omni_remember</code> (cookie)</td><td>Keeps you signed in on this browser</td><td>Up to 30 days</td><td>No: strictly necessary</td></tr>
            <tr><td><code>omni_token</code>, <code>omni_user</code>, <code>omni_user_id</code>, <code>omni_guest</code> (session storage)</td><td>Your current sign-in</td><td>Until you close the tab</td><td>No: strictly necessary</td></tr>
            <tr><td><code>reset_email</code>, <code>reset_code</code> (session storage)</td><td>Carries you through the password-reset steps</td><td>Until you close the tab</td><td>No: strictly necessary</td></tr>
            <tr><td><code>skepticall-e2e</code> (IndexedDB)</td><td>Your encryption keys, stored encrypted</td><td>Until you clear site data</td><td>No: strictly necessary</td></tr>
            <tr><td><code>omni_theme</code>, <code>omni_theme_preset</code>, <code>omni_accent_id</code>, <code>omni_bubble_style</code>, <code>omni_pinned</code> (local storage)</td><td>Your appearance settings and pinned chats</td><td>Until you clear site data</td><td>No: needed for settings you asked for</td></tr>
            <tr><td><code>skepticall_consent</code> (local storage)</td><td>Remembers your cookie choices</td><td>Until you clear site data</td><td>No: strictly necessary</td></tr>
            <tr><td>Google reCAPTCHA cookies (for example <code>_GRECAPTCHA</code>)</td><td>Spam protection on the sign-up form. Google also receives your IP address and browser details</td><td>Set by Google (up to about 6 months)</td><td><strong>Yes.</strong> Only loaded if you allow it</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Your choices</h2>
      <p>
        You can allow or refuse the optional item at any time: <CookieSettingsButton />. Turning it off stops reCAPTCHA loading on your next
        visit, and you can delete anything stored by clearing site data in your browser settings (this will sign you out, and removes your
        encryption keys from this browser, so keep a key backup first). Refusing reCAPTCHA means you can’t complete the sign-up form,
        because it’s our spam protection. Everything else works normally.
      </p>
      <p>More on how we handle data in our <Link to="/privacy-policy">Privacy Policy</Link>.</p>
    </LegalLayout>
  );
}
