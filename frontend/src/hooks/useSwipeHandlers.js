import { useRef, useCallback } from 'react';

/**
 * Detects a horizontal swipe on touch devices and fires onSwipeLeft /
 * onSwipeRight when one completes. Decision is made on touchend by
 * comparing total horizontal vs. vertical travel — nothing happens during
 * touchmove, so normal vertical scrolling (a channel list, a message feed)
 * is completely unaffected; this only reacts to a mostly-horizontal drag
 * that's long enough to be intentional, not an accidental scroll wobble.
 *
 * Spread the returned handlers onto whatever element should be swipeable:
 *   const swipe = useSwipeHandlers({ onSwipeLeft: openChat });
 *   <div {...swipe}>...</div>
 */
export function useSwipeHandlers({ onSwipeLeft, onSwipeRight, threshold = 60 } = {}) {
  const start = useRef(null);

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;

    if (Math.abs(dx) < threshold) return;              // too short to be intentional
    if (Math.abs(dx) < Math.abs(dy) * 1.3) return;      // too vertical — treat as a scroll, not a swipe

    if (dx < 0 && onSwipeLeft) onSwipeLeft();
    if (dx > 0 && onSwipeRight) onSwipeRight();
  }, [onSwipeLeft, onSwipeRight, threshold]);

  const onTouchCancel = useCallback(() => { start.current = null; }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
