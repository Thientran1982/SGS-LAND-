
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
                        // Support both named export and default export fallback
                        const component = module[componentName] || (module as any).default;
                        if (component) {
                            resolve({ default: component });
                        } else {
                            // If component is missing in module, throw specific error to trigger retry or catch
                            throw new Error(`Component "${componentName}" not found in module.`);
                        }
                    })
                    .catch((error) => {
                        console.warn(`Lazy load failed for ${componentName}. Attempts left: ${attemptsLeft}`, error);
                        if (attemptsLeft > 0) {
                            // Retry after delay
                            setTimeout(() => tryImport(attemptsLeft - 1), interval);
                        } else {
                            // On final failure, reject so ErrorBoundary can catch it
                            reject(error);
                        }
                    });
            };
            tryImport(retries);
        });
    });
};
