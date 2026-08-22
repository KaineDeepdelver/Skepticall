import React from 'react';

/**
 * SkepticallLogo — SVG gradient wordmark that reacts to the current accent.
 * Reads --accent-from and --accent-to CSS vars set by ThemeContext.
 * size: font size in px (default 28)
 * style: extra styles on the wrapper
 */
export default function OmniLogo({ size = 28, style = {}, onClick }) {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      onClick={onClick}
      xmlns="http://www.w3.org/2000/svg"
      height={size * 1.3}
      viewBox="0 0 240 40"
      style={{ cursor: onClick ? 'pointer' : 'default', flexShrink: 0, ...style }}
      aria-label="Skepticall"
    >
      <defs>
        <linearGradient id={`og-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="var(--accent-from, #2952e3)" />
          <stop offset="100%" stopColor="var(--accent-to,   #7c3aed)" />
        </linearGradient>
      </defs>
      <text
        x="0" y="32"
        fontFamily="'Oswald','DM Sans',system-ui,sans-serif"
        fontSize="34"
        fontWeight="700"
        letterSpacing="1"
        textLength="236"
        lengthAdjust="spacingAndGlyphs"
        fill={`url(#og-${id})`}
      >
        SKEPTICALL
      </text>
    </svg>
  );
}
