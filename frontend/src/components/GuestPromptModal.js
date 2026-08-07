import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuestPrompt } from '../context/GuestPromptContext';

// == GUEST LOGIN PROMPT MODAL ==
// Shown instead of instantly redirecting to /accounts/login. Lets the
// person choose to log in (taking them to sign-in, with `next` preserved
// so they land back where they were) or dismiss it and keep browsing.
export default function GuestPromptModal() {
  const { prompt, hideGuestPrompt } = useGuestPrompt();
  const navigate = useNavigate();

  if (!prompt) return null;
  const { action, next } = prompt;

  function goLogin() {
    hideGuestPrompt();
    navigate(`/accounts/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  }

  return (
    <div
      onClick={hideGuestPrompt}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card, var(--bg-primary))',
          border: '1px solid var(--border-input)',
          borderRadius: 16,
          padding: '24px 22px',
          maxWidth: 340,
          width: '100%',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Log in to continue
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
          You'll need an account to {action}. It only takes a moment to sign in or sign up.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={hideGuestPrompt}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: 'var(--bg-hover)', border: '1px solid var(--border-input)',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Not now
          </button>
          <button
            onClick={goLogin}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
