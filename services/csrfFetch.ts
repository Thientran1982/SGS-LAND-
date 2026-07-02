// services/csrfFetch.ts
// Installs a global fetch interceptor that injects the CSRF double-submit
// token header (X-CSRF-Token) into same-origin state-changing requests.
// The server issues a 'csrf_token' cookie (readable, non-HttpOnly) via
// csrfTokenIssuer; enforcing csrfProtection() validates the header.
// This centralizes CSRF so raw fetch() call sites do not each need editing.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
const HEADER_NAME = 'X-CSRF-Token';

function readCsrfCookie(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function isSameOrigin(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

let installed = false;

export function installCsrfFetch(): void {
  if (installed || typeof window === 'undefined' || !window.fetch) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

      if (!SAFE_METHODS.has(method) && isSameOrigin(url)) {
        const token = readCsrfCookie();
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has(HEADER_NAME)) {
            headers.set(HEADER_NAME, token);
          }
          const nextInit: RequestInit = { ...(init || {}), headers };
          if (!('credentials' in nextInit) || nextInit.credentials === undefined) {
            nextInit.credentials = 'include';
          }
          return originalFetch(input, nextInit);
        }
      }
    } catch {
      // Fall through to the original fetch on any interceptor error.
    }
    return originalFetch(input as any, init);
  };
}
