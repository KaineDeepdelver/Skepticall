import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LegalLayout from '../legal/LegalLayout';
import { api } from '../services/api';
import { business } from '../config/business';

function errorText(e) {
  const raw = (e && e.message) || 'Something went wrong. Please try again.';
  try { return JSON.parse(raw).message || raw; } catch { return raw; }
}

/** Step 2: the person opened the link from the email and confirms. */
function ConfirmDeletion({ token }) {
  const [state, setState] = useState('idle'); // idle | working | done | error
  const [error, setError] = useState('');

  async function confirm() {
    setState('working');
    setError('');
    try {
      await api.confirmDeletion(token);
      setState('done');
    } catch (e) {
      setError(errorText(e));
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="lg-card" role="status">
        <h2>Your account has been deleted</h2>
        <p className="lg-ok">Your profile, messages, groups, friends and files were removed. You can close this page.</p>
      </div>
    );
  }
  return (
    <div className="lg-card">
      <h2>Permanently delete your account?</h2>
      <p>
        This removes your profile, your messages, your friends and group memberships, your uploaded files and your encryption
        key history. <strong>It can’t be undone.</strong>
      </p>
      <button type="button" className="lg-btn lg-btn--danger" onClick={confirm} disabled={state === 'working'}>
        {state === 'working' ? 'Deleting…' : 'Yes, permanently delete my account'}
      </button>
      {state === 'error' && <p className="lg-err" role="alert">{error} The link may have expired: you can request a new one <Link to="/data-deletion">here</Link>.</p>}
    </div>
  );
}

/** Step 1: ask for the email link. */
function RequestDeletion() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('working');
    try { await api.requestDeletion(email.trim()); } catch { /* the answer is the same either way */ }
    setState('sent');
  }

  return (
    <>
      <h2>Can’t sign in? Delete your data by email</h2>
      <p>Enter the email address of your account. If it matches an account, we’ll email you a link that lasts 1 hour. Opening it lets you confirm the deletion.</p>
      <form className="lg-form" onSubmit={submit}>
        <label>Email address
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={state === 'working'} />
        </label>
        <button className="lg-btn lg-btn--primary" disabled={state === 'working'}>Send me the link</button>
      </form>
      {state === 'sent' && (
        <p className="lg-ok" role="status">
          If an account uses that address, a confirmation link is on its way. (We give the same answer either way, so nobody can use this form to find out who has an account.)
        </p>
      )}
    </>
  );
}

export default function DataDeletionPage({ confirm = false }) {
  const [params] = useSearchParams();
  const token = params.get('token');

  if (confirm) {
    return (
      <LegalLayout title="Delete my account" showUpdated={false}>
        {token ? <ConfirmDeletion token={token} /> : <p className="lg-err">This link is missing its token. Request a new one <Link to="/data-deletion">here</Link>.</p>}
      </LegalLayout>
    );
  }

  return (
    <LegalLayout title="Delete my data" showUpdated={false}>
      <p>You can have your account and its data deleted at any time. Pick whichever is easiest.</p>

      <div className="lg-card">
        <h2>1. In the app (instant)</h2>
        <p>Sign in, then go to <strong>Settings → Security → Delete account</strong> and enter your password.</p>
      </div>

      <div className="lg-card"><RequestDeletion /></div>

      <div className="lg-card">
        <h2>3. Ask us</h2>
        <p>
          {business.email
            ? <>Email <a href={`mailto:${business.email}`}>{business.email}</a> from the address on your account.</>
            : <>Use the contact details at the bottom of this page.</>}{' '}
          We’ll answer within one month.
        </p>
      </div>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your profile, username, email address and password hash.</li>
        <li>Every message you sent or received that we still hold (they are removed on both sides: the server only keeps messages in transit), and the files attached to them.</li>
        <li>Your friends and friend requests, notifications and call history.</li>
        <li>Your group memberships. Groups you created pass to another member, or are deleted if nobody is left.</li>
        <li>Your encryption key history and your consent record.</li>
      </ul>
      <p>
        Copies of messages on other people’s devices are theirs and aren’t reached by this. Our providers’ backups and logs can keep data for a
        short time until they rotate out (see the <Link to="/privacy-policy">Privacy Policy</Link>). Key backup files you downloaded become
        useless once your account is gone, but delete them too.
      </p>
    </LegalLayout>
  );
}
