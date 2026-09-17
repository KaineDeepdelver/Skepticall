import { useState, useEffect } from 'react';

/**
 * Tracks whether the viewport is at or below the app's mobile breakpoint
 * (768px, matching the media queries in global.css). Updates on resize/
 * orientation change so components can switch layouts live rather than
 * only on first render — e.g. rotating a tablet or resizing a browser
 * window shouldn't require a reload to pick up the right layout.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= breakpoint);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return isMobile;
}
