import { useCallback, useEffect, useState } from 'react';

// UX audit 3.6: keep list filters in the query string so a filtered view
// survives reload, back/forward and can be shared as a link.

export const readUrlParam = (key: string, fallback: string): string => {
  try {
    const v = new URLSearchParams(window.location.search).get(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
};

export function useUrlState(key: string, fallback: string) {
  const [value, setValue] = useState<string>(() => readUrlParam(key, fallback));

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const current = url.searchParams.get(key);
      const next = value === fallback || value === '' ? null : value;
      if (current === next) return;
      if (next === null) url.searchParams.delete(key);
      else url.searchParams.set(key, next);
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    } catch { /* non-browser */ }
  }, [key, value, fallback]);

  const set = useCallback((v: string | ((prev: string) => string)) => setValue(v), []);
  return [value, set] as const;
}
