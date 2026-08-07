import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
export default function ForgotPasswordVerify() {
  const { theme } = useTheme();
  const [code, setCode]         = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const navigate = useNavigate();
  const email = localStorage.getItem('reset_email') || '';

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      // store code for the next step
      localStorage.setItem('reset_code', code);
      navigate('/forgot-password/reset');
    } catch (err) {
      setError(err.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    try {
      await api.sendResetCode(email);
      setError('');
      setCooldown(60);
    } catch (err) {
      setError('Failed to resend code.');
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">Omni</div>
        <div className="auth-title">Check your email</div>
        <div className="auth-chip">{email}</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 12px' }}>
          We sent a 6-digit reset code to your email.
        </p>
        <input className="auth-input" placeholder="000000" maxLength={6}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/, ''))} autoFocus />
        <div className="auth-error">{error}</div>
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </button>
        <div
          onClick={resend}
          style={{
            marginTop: '12px',
            fontSize: '14px',
            textAlign: 'center',
            cursor: cooldown > 0 ? 'default' : 'pointer',
            color: cooldown > 0 ? 'var(--text-secondary)' : 'var(--accent)',
            transition: 'color 0.3s',
          }}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
        </div>
      </form>
    </div>
  );
}
