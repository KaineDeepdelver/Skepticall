import React from 'react';

/** Small inline loading ring. Takes the colour and size of the surrounding text. */
export default function Spinner({ size = '1em', label = 'Loading' }) {
  return <span className="spin" role="status" aria-label={label} style={{ width: size, height: size }} />;
}
