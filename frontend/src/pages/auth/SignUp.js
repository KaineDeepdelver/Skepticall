import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const EMAIL_PATTERN    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\s]).{8,}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';

function useRecaptchaScript() {
  const [ready, setReady] = useState(!!(window.grecaptcha && window.grecaptcha.render));
  useEffect(() => {
    if (window.grecaptcha && window.grecaptcha.render) { setReady(true); return; }
    if (!window.__omniRecaptchaCallbacks) window.__omniRecaptchaCallbacks = [];
    window.__omniRecaptchaCallbacks.push(() => setReady(true));
    if (!window.__omniOnRecaptchaLoad) {
      window.__omniOnRecaptchaLoad = () => {
        window.__omniRecaptchaCallbacks.forEach(cb => cb());
        window.__omniRecaptchaCallbacks = [];
      };
    }
    if (document.getElementById('recaptcha-script')) return;
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = 'https://www.google.com/recaptcha/api.js?onload=__omniOnRecaptchaLoad&render=explicit';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);
  return ready;
}

const STEPS = ['email', 'password', 'profile'];

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

export default function SignUp() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [showConfirmPw, setShowConfirmPw]     = useState(false);
  const [username, setUsername]               = useState('');
  const [displayName, setDisplayName]         = useState('');
  const [tosAccepted, setTosAccepted]         = useState(false);
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [captchaToken, setCaptchaToken]       = useState('');

  const captchaRef  = useRef(null);
  const widgetIdRef = useRef(null);
  const scriptReady = useRecaptchaScript();

  useEffect(() => {
    if (step !== 'profile') return;
    if (!scriptReady || !RECAPTCHA_SITE_KEY || !captchaRef.current || widgetIdRef.current !== null) return;
    if (!window.grecaptcha || typeof window.grecaptcha.render !== 'function') return;
    widgetIdRef.current = window.grecaptcha.render(captchaRef.current, {
      sitekey: RECAPTCHA_SITE_KEY,
      callback: (token) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(''),
    });
  }, [scriptReady, step]);

  function resetCaptcha() {
    if (window.grecaptcha && widgetIdRef.current !== null) {
      window.grecaptcha.reset(widgetIdRef.current);
    }
    setCaptchaToken('');
  }

  function goBack() {
    setError('');
    setStepIndex(i => Math.max(0, i - 1));
  }

  // -- Step 1: email
  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    if (!EMAIL_PATTERN.test(email)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const taken = await api.checkEmail(email);
      if (taken) { setError('An account with that email already exists.'); return; }
      setStepIndex(1);
    } catch {
      setError('Server error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // -- Step 2: password + confirm
  function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    if (!PASSWORD_PATTERN.test(password)) {
      setError('Password needs min 8 chars, uppercase, lowercase, number, special char.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setStepIndex(2);
  }

  // -- Step 3: username + display name + ToS + captcha
  async function handleProfileSubmit(e) {
    e.preventDefault();
    setError('');
    if (!USERNAME_PATTERN.test(username)) {
      setError('Username must be 3-20 characters (letters, numbers, _)');
      return;
    }
    if (!tosAccepted) { setError('You must accept the Terms of Service to create an account.'); return; }
    if (!captchaToken) { setError('Please complete the captcha.'); return; }
    setLoading(true);
    try {
      const usernameTaken = await api.checkUsername(username);
      if (usernameTaken) { setError('Username already taken'); setLoading(false); resetCaptcha(); return; }
      await api.register({ username, email, password, displayName: displayName || null, captchaToken });
      const response = await api.login(email, password);
      login(response);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">

      {step === 'email' && (
        <form className="auth-card" onSubmit={handleEmailSubmit}>
          <div className="auth-logo">Omni</div>
          <div className="auth-title">Create your account</div>
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
          <div className="auth-link">Already have an account? <Link to="/accounts/login">Sign in</Link></div>
        </form>
      )}

      {step === 'password' && (
        <form className="auth-card" onSubmit={handlePasswordSubmit}>
          <div className="auth-title">Create a password</div>
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

          <div className="auth-input-wrap">
            <input
              className="auth-input"
              type={showConfirmPw ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-reveal-btn"
              onClick={() => setShowConfirmPw(v => !v)}
              aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
            >
              {showConfirmPw ? <EyeOff /> : <Eye />}
            </button>
          </div>

          <div className="auth-error">{error}</div>
          <button className="auth-btn" type="submit">Continue</button>
          <div className="auth-link" style={{ cursor: 'pointer' }} onClick={goBack}>← Back</div>
        </form>
      )}

      {step === 'profile' && (
        <form className="auth-card" onSubmit={handleProfileSubmit}>
          <div className="auth-title">Set up your profile</div>
          <input
            className="auth-input"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
          <input
            className="auth-input"
            placeholder="Display name (optional)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <label className="tos-checkbox-row">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={e => setTosAccepted(e.target.checked)}
            />
            <span className="tos-checkbox-label">
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="tos-link" onClick={e => e.stopPropagation()}>
                Terms of Service
              </a>
              {' '}and{' '}
              <a href="/privacy-policy" target="_blank" rel="noreferrer" className="tos-link" onClick={e => e.stopPropagation()}>
                Privacy Policy
              </a>
            </span>
          </label>
          {RECAPTCHA_SITE_KEY ? (
            <div ref={captchaRef} style={{ margin: '4px 0' }} />
          ) : (
            <div className="auth-error" style={{ fontSize: 12 }}>
              Captcha not configured — set REACT_APP_RECAPTCHA_SITE_KEY to enable signups.
            </div>
          )}
          <div className="auth-error">{error}</div>
          <button className="auth-btn" type="submit" disabled={loading || !tosAccepted || (!!RECAPTCHA_SITE_KEY && !captchaToken)}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <div className="auth-link" style={{ cursor: 'pointer' }} onClick={goBack}>← Back</div>
        </form>
      )}

    </div>
  );
}
