import React, { useEffect, useRef, useState } from 'react';

/**
 * A thin bar along the top of the screen while the app is waiting on the server.
 * api.js reports every request through the 'omni:net' event. The bar only appears once
 * something has been pending for a moment, so quick requests never make it flicker.
 */
export default function TopProgress({ showAfterMs = 350 }) {
  const [on, setOn] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const onNet = (e) => {
      const pending = (e.detail && e.detail.pending) || 0;
      if (pending > 0) {
        if (!timer.current && !on) timer.current = setTimeout(() => { timer.current = null; setOn(true); }, showAfterMs);
      } else {
        clearTimeout(timer.current); timer.current = null;
        setOn(false);
      }
    };
    window.addEventListener('omni:net', onNet);
    return () => { window.removeEventListener('omni:net', onNet); clearTimeout(timer.current); };
  }, [on, showAfterMs]);

  return (
    <div className={`top-progress${on ? ' is-on' : ''}`} role="progressbar" aria-hidden={!on} aria-label="Loading">
      <i />
    </div>
  );
}
