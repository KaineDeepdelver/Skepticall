import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Where a "Back" button should go. If the person arrived by following links inside the app, go back one step.
 * If this page was opened directly (a shared link, a refresh, a new tab) there is nothing to go back to, and
 * navigate(-1) would do nothing or leave the site, so go to `fallback` instead.
 */
export default function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, location.key, fallback]);
}
