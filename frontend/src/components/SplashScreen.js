import React, { useEffect, useState } from 'react';

/**
 * Full-screen loading screen: three rings spreading out from a dot, like a call going out.
 *
 * Shown while the app starts and while a remembered login is restored (that check can take a
 * minute if the server has been asleep). It fades in after a short delay, so a fast load never
 * flashes it. After a few seconds it explains why it is taking a while.
 *
 * `initial` marks the very first screen (index.html shows the same markup before JavaScript
 * loads), so the fade-in timing carries on from there instead of restarting.
 */
export default function SplashScreen({ initial = false, hintAfterMs = 4000, delayMs = 200 }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), hintAfterMs);
    return () => clearTimeout(t);
  }, [hintAfterMs]);

  const delay = initial ? Math.max(0, 250 - Math.round(performance.now())) : delayMs;

  return (
    <div className="splash" role="status" aria-live="polite" aria-label="Loading Skepticall" style={{ '--splash-delay': `${delay}ms` }}>
      <div className="splash-mark" aria-hidden="true">
        <i className="splash-ring" /><i className="splash-ring" /><i className="splash-ring" /><i className="splash-dot" />
      </div>
      {slow && (
        <p className="splash-hint">
          Waking up the server. The first load after a quiet spell can take up to a minute.
        </p>
      )}
    </div>
  );
}
