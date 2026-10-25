import { lazy } from 'react';

/**
 * React.lazy that survives a new deploy. A tab opened before a deploy still points at old file names,
 * and loading one fails. Reload once to pick up the new files; if it still fails, report the error.
 */
export default function lazyWithRetry(load) {
  return lazy(async () => {
    try {
      const mod = await load();
      sessionStorage.removeItem('omni_chunk_retry');
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem('omni_chunk_retry')) {
        sessionStorage.setItem('omni_chunk_retry', '1');
        window.location.reload();
        return new Promise(() => {}); // the page is reloading
      }
      throw err;
    }
  });
}
