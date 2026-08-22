import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
export default function ForgotPasswordEmail() {
  const { theme } = useTheme();
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) { setError('Enter your email address.'); return; }
    setLoading(true); setError('');
    try {
      const exists = await api.checkEmail(email);
      if (!exists) { setError("We couldn't find an account with that email."); return; }
      await api.sendResetCode(email);
      localStorage.setItem('reset_email', email);
      navigate('/forgot-password/verify');
    } catch (err) {
      setError(err.message || 'Server error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">Skepticall</div>
        <div className="auth-title">Forgot password?</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 16px' }}>
          Enter your email and we'll send you a reset code.
        </p>
        <input className="auth-input" type="email" placeholder="Email address"
          value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        <div className="auth-error">{error}</div>
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Sending code…' : 'Continue'}
        </button>
        <div className="auth-link"><Link to="/accounts/login">← Back to sign in</Link></div>
      </form>
    </div>
  );
}
