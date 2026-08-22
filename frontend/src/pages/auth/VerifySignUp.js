import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
export default function VerifySignUp() {
  const { theme } = useTheme();
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const email = localStorage.getItem('signup_email') || '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true); setError('');
    try {
      await api.verifyRegistrationCode(email, code);
      navigate('/signup/password');
    } catch (err) {
      setError(err.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      await api.sendRegistrationCode(email);
      setError('Code resent!');
    } catch (err) {
      setError('Failed to resend code');
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">Skepticall</div>
        <div className="auth-title">Check your email</div>
        <div className="auth-chip">{email}</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 12px' }}>
          We sent a 6-digit code to your email.
        </p>
        <input className="auth-input" placeholder="000000" maxLength={6}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/, ''))} autoFocus />
        <div className="auth-error">{error}</div>
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </button>
        <div className="auth-link" style={{ cursor: 'pointer' }} onClick={resend}>
          Didn't get it? Resend code
        </div>
      </form>
    </div>
  );
}
