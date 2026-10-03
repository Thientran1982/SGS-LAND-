---
name: MapLibre Next worker routing
description: MapLibre worker loading when Next.js and Webpack bundle the public map.
---

MapLibre GL JS can produce an empty default worker URL when Next/Webpack turns `import.meta.url` into an internal bundle identifier rather than an HTTP(S) URL. Setting an explicit URL is necessary, but serving only `maplibre-gl-worker.mjs` is not sufficient: that module imports `maplibre-gl-shared.mjs` relative to its own URL. A 200 response for the worker alone can still end in “Worker failed to load.”

**Why:** Module workers resolve relative imports from the worker URL, while Next's internal bundle URL cannot serve the package's sibling module.

**How to apply:** Point MapLibre at a same-origin path that preserves the package's sibling filenames, and serve both allowlisted `.mjs` files with a JavaScript MIME type. Verify both responses and the absence of worker errors through the actual Replit Preview hostname, including localized routes.