import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
export default function ForgotPasswordReset() {
  const { theme } = useTheme();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const navigate = useNavigate();
  const email = localStorage.getItem('reset_email') || '';
  const code  = localStorage.getItem('reset_code')  || '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6)      { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)     { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await api.resetPassword(email, code, password);
      localStorage.removeItem('reset_email');
      localStorage.removeItem('reset_code');
      navigate('/accounts/login');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">Omni</div>
        <div className="auth-title">Set new password</div>
        <input className="auth-input" type="password" placeholder="New password"
          value={password} onChange={e => setPassword(e.target.value)} autoFocus />
        <input className="auth-input" type="password" placeholder="Confirm new password"
          value={confirm} onChange={e => setConfirm(e.target.value)}
          style={{ marginTop: '10px' }} />
        <div className="auth-error">{error}</div>
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
