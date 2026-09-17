import React, { createContext, useContext, useState, useCallback } from 'react';

// == GUEST PROMPT CONTEXT ==
// Holds the "you need an account to do that" prompt state so it can be
// triggered from anywhere (any button, any page) and rendered once at
// the top of the app instead of instantly redirecting people away from
// whatever they were doing.
const GuestPromptContext = createContext(null);

export function GuestPromptProvider({ children }) {
  const [prompt, setPrompt] = useState(null); // { action, next } | null

  const showGuestPrompt = useCallback((action, next) => {
    setPrompt({ action, next });
  }, []);

  const hideGuestPrompt = useCallback(() => setPrompt(null), []);

  return (
    <GuestPromptContext.Provider value={{ prompt, showGuestPrompt, hideGuestPrompt }}>
      {children}
    </GuestPromptContext.Provider>
  );
}

export const useGuestPrompt = () => useContext(GuestPromptContext);
