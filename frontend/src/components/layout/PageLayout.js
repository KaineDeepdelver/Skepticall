import React from 'react';
import SearchSidebar from '../SearchSidebar';

/**
 * Wraps a page with the right-side search sidebar.
 * Usage: <PageLayout><YourPageContent/></PageLayout>
 */
export default function PageLayout({ children, showSearch = true }) {
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {children}
      </div>
      {showSearch && <SearchSidebar />}
    </div>
  );
}
