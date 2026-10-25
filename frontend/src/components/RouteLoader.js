import React from 'react';

/** Loading state for the content area while a page's code downloads. The app shell stays put. */
export default function RouteLoader() {
  return (
    <div className="route-loader" role="status" aria-label="Loading page">
      <span className="spin spin--lg" />
    </div>
  );
}
