import React, { createContext, useContext, useState } from 'react';

const SidebarContext = createContext();

export function SidebarProvider({ children }) {
  const [collapsed,    setCollapsed]    = useState(false); // full by default
  const [hidden,       setHidden]       = useState(false); // video page mode
  const [overlayOpen,  setOverlayOpen]  = useState(false); // overlay open on video page

  return (
    <SidebarContext.Provider value={{
      collapsed,
      hidden,
      overlayOpen,
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
