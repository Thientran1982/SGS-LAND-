import { useEffect, useRef } from 'react';
import { api } from './api/apiClient';
import { PAGE_LABELS } from '../config/pageLabels';

async function trackPageView(path: string): Promise<void> {
  if (!path) return;
  const pageLabel = PAGE_LABELS[path] || path;
  try {
    await api.post('/api/activity/pageview', { path, pageLabel });
  } catch {
    // Silent — tracking should never break the app
  }
}

export function usePageTracker(isAuthenticated: boolean, currentPath: string) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    if (!isAuthenticated || !currentPath) return;
    if (currentPath === lastTrackedRef.current) return;

    lastTrackedRef.current = currentPath;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      trackPageView(currentPath);
    }, 1000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [isAuthenticated, currentPath]);
}
