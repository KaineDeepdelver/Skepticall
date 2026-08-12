import React, { createContext, useContext, useState } from 'react';

const SidebarContext = createContext();

const WIDTH_KEY = 'sidebarWidth';
const DEFAULT_WIDTH = 220;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;

function loadWidth() {
  const saved = parseInt(localStorage.getItem(WIDTH_KEY), 10);
  if (Number.isFinite(saved)) return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, saved));
  return DEFAULT_WIDTH;
}

export function SidebarProvider({ children }) {
  const [collapsed,    setCollapsed]    = useState(false); // full by default
  const [hidden,       setHidden]       = useState(false); // video page mode
  const [overlayOpen,  setOverlayOpen]  = useState(false); // overlay open on video page
  const [width,        setWidthState]   = useState(loadWidth);

  function setWidth(w) {
    const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, w));
    setWidthState(clamped);
    localStorage.setItem(WIDTH_KEY, String(clamped));
  }

  return (
    <SidebarContext.Provider value={{
      collapsed,
      hidden,
      overlayOpen,
      width,
      setWidth,
      toggle:         () => setCollapsed(o => !o),
      setHidden:      (v) => { setHidden(v); if (!v) setOverlayOpen(false); },
      toggleOverlay:  () => setOverlayOpen(o => !o),
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
