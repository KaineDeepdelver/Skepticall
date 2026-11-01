import React from 'react';
import Glyph from './icons/Glyph';

/**
 * The one way to leave a screen, panel, drawer or viewer: a "<" in a round button.
 * Put it at the start of the header, before the title. `label` is what screen readers say.
 */
export default function ExitButton({ onClick, label = 'Back', style, className = '' }) {
  return (
    <button type="button" className={`hdr-btn exit-btn ${className}`.trim()} aria-label={label} title={label} onClick={onClick} style={style}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><Glyph n="chevron-left" /></svg>
    </button>
  );
}

/** A small "<" to sit in front of the words of a text link such as "Back to sign in". */
export function BackChevron() {
  return <svg className="back-chevron" viewBox="0 0 24 24" aria-hidden="true"><Glyph n="chevron-left" /></svg>;
}
