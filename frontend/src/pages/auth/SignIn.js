import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function SignIn() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const reason = params.get('reason');

  function handleGuest() {
    navigate(reason === 'account' ? '/' : next, { replace: true });
  }

  const [step, setStep]         = useState('email');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email) { setError('Enter a valid email address.'); return; }
    setLoading(true); setError('');
    try {
      const exists = await api.checkEmail(email);
      if (exists) setStep('password');
      else setError("We couldn't find an account with that email. Try another or sign up.");
    } catch { setError('Server error. Try again.'); }
    finally { setLoading(false); }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await api.login(email, password);
      login(response);
      navigate(next, { replace: true });
    } catch { setError('Wrong password. Try again.'); }
    finally { setLoading(false); }
  }

  function backToEmail() {
    setStep('email');
    setPassword('');
    setShowPw(false);
    setError('');
  }

  return (
    <div className="auth-page">
      {step === 'email' ? (
        <form className="auth-card" onSubmit={handleEmailSubmit}>
          <div className="auth-title">Sign in</div>
          {reason === 'account' && (
            <div className="auth-error" style={{ marginBottom: 8 }}>You'll need an account for that — log in or sign up to continue.</div>
          )}
          <input
            className="auth-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
          />
          <div className="auth-error">{error}</div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Continue'}
          </button>
          <div className="auth-link">Don't have an account? <Link to="/accounts/register">Sign up</Link></div>
          <div className="auth-link" style={{ cursor: 'pointer' }} onClick={handleGuest}>
            Continue as guest
          </div>
        </form>
      ) : (
        <form className="auth-card" onSubmit={handlePasswordSubmit}>
          <div className="auth-title">Enter your password</div>
          <div className="auth-chip">{email}</div>
          <div className="auth-input-wrap">
            <input
              className="auth-input"
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="auth-reveal-btn"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <div className="auth-error">{error}</div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="auth-link" style={{ cursor: 'pointer' }} onClick={backToEmail}>
            ← Use a different email
          </div>
        </form>
      )}
    </div>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
