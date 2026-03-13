
import React from 'react';

/**
 * Lazy Load Helper with Retry Logic and Error Logging.
 * Adapts named exports (e.g. `export const Page = ...`) to React.lazy's default export expectation.
 * Includes a retry mechanism for flaky networks or redeploy scenarios (Connection Refused).
 */
export const lazyLoad = <T extends React.ComponentType<any>>(
    importFunc: () => Promise<{ [key: string]: T }>, 
    componentName: string,
    retries = 2,
    interval = 1000
) => {
    return React.lazy(() => {
        return new Promise<{ default: T }>((resolve, reject) => {
            const tryImport = (attemptsLeft: number) => {
                importFunc()
                    .then(module => {
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
