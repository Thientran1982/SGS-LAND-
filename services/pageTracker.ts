import { useEffect, useRef } from 'react';
import { api } from './api/apiClient';
import { PAGE_LABELS } from '../config/pageLabels';

function getPathFromHash(): string {
  let hash = window.location.hash.slice(1);
  if (hash.startsWith('/')) hash = hash.slice(1);
  if (hash.endsWith('/')) hash = hash.slice(0, -1);
  return hash.split('?')[0].split('/')[0] || '';
}

async function trackPageView(path: string): Promise<void> {
  if (!path) return;
  const pageLabel = PAGE_LABELS[path] || path;
  try {
    await api.post('/api/activity/pageview', { path, pageLabel });
  } catch {
    // Silent — tracking should never break the app
  }
}

export function usePageTracker(isAuthenticated: boolean) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    if (!isAuthenticated) return;

    const track = () => {
      const path = getPathFromHash();
      if (!path || path === lastTrackedRef.current) return;
      lastTrackedRef.current = path;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        trackPageView(path);
      }, 1000);
    };

    track();

    window.addEventListener('hashchange', track);
    return () => {
      window.removeEventListener('hashchange', track);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isAuthenticated]);
}
