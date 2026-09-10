---
name: CRM React runtime isolation
description: React invalid-hook-call failures caused by multiple workspace app installs and Vite lazy-route/HMR module identity
---

The root CRM Vite app must resolve `react` and `react-dom` to one root runtime and dedupe both packages. Separate React installs under sibling apps are not used by the CRM, but they can make module resolution and HMR failures harder to diagnose.

**Why:** A lazy-loaded CRM page reported `Invalid hook call` even though its hooks were unconditional and the dependency tree was version-matched; the workspace also contains separate app installs. Pinning the root runtime and restarting Vite removed the route-level failure.

**How to apply:** Keep root Vite `resolve.dedupe` and absolute aliases for `react`, `react-dom`, both JSX runtimes, and `react-dom/client` together. After changing the Vite dependency graph, clear `node_modules/.vite`, restart the workflow, and verify the affected lazy route rather than relying only on TypeScript.