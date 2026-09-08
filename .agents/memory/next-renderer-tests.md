---
name: Next app renderer tests
description: Root Vitest tests that render components from the isolated Next app need the app-matched React server renderer.
---

Root Vitest resolves React from the workspace while files under `apps/nextjs` can resolve the app's isolated React installation. Rendering those components with the root ReactDOM produces an invalid hook call even though the component is correct.

**Why:** The workspace currently contains separate React dependency trees for the root app and the Next public site.

**How to apply:** For focused static renderer tests, pair the imported Next component with `apps/nextjs/node_modules/react-dom/server`; use DOM parsing for assertions instead of the root Testing Library renderer.