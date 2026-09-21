---
name: Preview service worker hydration
description: A production service worker can keep stale Next client chunks when the same preview origin returns to the dev workflow.
---

When the Replit preview switches from a production-served app back to Next development on the same origin, an existing production Service Worker can serve cached `_next/static` assets beside fresh SSR HTML. This produces a false hydration mismatch even when the source markup is static.

**Why:** The Service Worker uses cache-first handling for static assets and survives workflow restarts; deleting `.next` on the server does not delete browser registrations or Cache Storage.

**How to apply:** Development must unregister existing service workers and delete project-owned caches before hydration. In production, bump the cache namespace when client behavior changes, do not cache the worker script itself, and register it with `updateViaCache: "none"` plus a revision query so stale bundles can actually be evicted. Keep production registration separate, and add browser smoke coverage for stale-worker recovery.