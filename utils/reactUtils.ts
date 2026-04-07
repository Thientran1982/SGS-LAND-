
import React from 'react';

/**
 * Detect whether an error is a Vite/webpack chunk-load failure (e.g. after redeploy).
 * Chunk errors occur when a hashed JS asset no longer exists on the server.
 */
function isChunkLoadError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message || '';
    return (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('dynamically imported module') ||
        (error as any).name === 'ChunkLoadError'
    );
}

/** sessionStorage key used to prevent infinite reload loops on true chunk errors. */
const CHUNK_RELOAD_KEY = '__sgs_chunk_reload__';

/**
 * Force a hard page reload after a chunk-load failure.
 * Uses sessionStorage to prevent looping: if we already reloaded once for this session,
 * fall through to the normal error flow so the ErrorBoundary can display the error.
 */
function reloadOnceForChunkError(): boolean {
    const already = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (already) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
    return true;
}

/**
 * Lazy Load Helper with Retry Logic and Error Logging.
 * Adapts named exports (e.g. `export const Page = ...`) to React.lazy's default export expectation.
 * On chunk-load failures (post-deploy hash mismatch) triggers a one-time page reload so users
 * automatically pick up the new bundle without seeing an error screen.
 */
export const lazyLoad = <T extends React.ComponentType<any>>(
    importFunc: () => Promise<{ [key: string]: T }>, 
    componentName: string,
    retries = 2,
    interval = 300
) => {
    return React.lazy(() => {
        return new Promise<{ default: T }>((resolve, reject) => {
            const tryImport = (attemptsLeft: number) => {
                importFunc()
                    .then(module => {
                        // Clear the reload guard on a successful load (new deployment is live)
                        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
                        const component = module[componentName] || (module as any).default;
                        if (component) {
                            resolve({ default: component });
                        } else {
                            throw new Error(`Component "${componentName}" not found in module.`);
                        }
                    })
                    .catch((error) => {
                        console.warn(`Lazy load failed for ${componentName}. Attempts left: ${attemptsLeft}`, error);
                        if (attemptsLeft > 0) {
                            setTimeout(() => tryImport(attemptsLeft - 1), interval);
                        } else if (isChunkLoadError(error)) {
                            // After all retries, if this is a chunk hash mismatch, reload once.
                            if (!reloadOnceForChunkError()) {
                                reject(error);
                            }
                            // If reload was triggered, Promise hangs — the page will reload anyway.
                        } else {
                            reject(error);
                        }
                    });
            };
            tryImport(retries);
        });
    });
};

// ---------------------------------------------------------------------------
// PREFETCH REGISTRY
// Allows registering import functions by route key, then calling prefetchRoute()
// on nav hover to kick off Vite module transform BEFORE the user clicks.
// ---------------------------------------------------------------------------

const _prefetchDone = new Set<string>();
const _prefetchRegistry: Record<string, () => Promise<any>> = {};

export const registerPrefetch = (routeKey: string, importFn: () => Promise<any>): void => {
    _prefetchRegistry[routeKey] = importFn;
};

/**
 * Fire-and-forget: starts the dynamic import for `routeKey` if not already done.
 * Call this onMouseEnter of nav links so the chunk is ready before the click.
 */
export const prefetchRoute = (routeKey: string): void => {
    if (_prefetchDone.has(routeKey) || !_prefetchRegistry[routeKey]) return;
    _prefetchDone.add(routeKey);
    _prefetchRegistry[routeKey]().catch(() => {});
};

/**
 * Prefetch multiple routes at once (e.g. top pages after auth).
 */
export const prefetchRoutes = (routeKeys: string[]): void => {
    routeKeys.forEach(prefetchRoute);
};
