---
name: SPA loading ownership
description: Loading ownership between the Vite shell and the React route tree
---

The Vite HTML shell should not render a visible loading screen when the React application already owns route and lazy-chunk fallbacks. Keep one loading surface under React so initial boot and route transitions do not show sequential loaders.

**Why:** The static shell loader and the App-level Suspense/auth fallback rendered one after another, making a single navigation look like two loading cycles.

**How to apply:** When adding or changing route loading UI, first check `index.html`, `App.tsx`, and App Router `loading.tsx` together. Use a static shell only if React cannot provide the first visible fallback, and do not add a second full-screen fallback for the same transition.