import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGuestPrompt } from '../context/GuestPromptContext';

// == GUEST ACTION GATE ==
// Call requireAccount() before any action that needs a real account
// (like, vote, comment, react, reply, message, post, upload, etc).
// Returns true and does nothing if the user has a real account.
// Returns false and pops up a "you need an account to do that" modal
// (instead of instantly redirecting) if they're a guest — the person
// chooses whether to go log in or keep browsing.
export function useRequireAccount() {
  const { user } = useAuth();
  const { showGuestPrompt } = useGuestPrompt();
  const location = useLocation();

  return useCallback((action = 'do that') => {
    if (user) return true;
    const next = location.pathname + location.search;
    showGuestPrompt(action, next);
    return false;
  }, [user, showGuestPrompt, location]);
}
