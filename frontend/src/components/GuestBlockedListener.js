import { useEffect } from 'react';
import { useGuestPrompt } from '../context/GuestPromptContext';

// == GUEST BLOCK SAFETY NET ==
// api.js blocks any mutating request made while signed out and fires this
// event. Most action buttons already show their own specific "log in to
// do X" prompt via useRequireAccount before the call is ever made — this
// is just a fallback so nothing fails silently.
export default function GuestBlockedListener() {
  const { showGuestPrompt } = useGuestPrompt();

  useEffect(() => {
    let last = 0;
    const onBlocked = () => {
      const now = Date.now();
      if (now - last < 1000) return; // avoid stacking duplicate prompts
      last = now;
      showGuestPrompt('do that');
    };
    window.addEventListener('omni:guest-blocked', onBlocked);
    return () => window.removeEventListener('omni:guest-blocked', onBlocked);
  }, [showGuestPrompt]);

  return null;
}
