---
name: Next.js Turbopack watcher exhaustion
description: Development preview can fail with ENOSPC and misleading missing React module errors after repeated restarts.
---

When Next.js Turbopack reports `ENOSPC: System limit for number of file watchers reached`, the missing React/Recharts module messages are usually secondary resolver failures, not dependency corruption.

**Why:** Repeated preview restarts can leave development cache watcher state in a bad condition even when the configured inotify limits appear sufficient.

**How to apply:** Stop stale app processes, remove only `apps/nextjs/.next`, then restart the existing application workflow before debugging application imports.

Do not run a production Next build into the default `.next` directory while the Turbopack dev workflow is active; use `NEXT_DIST_DIR` for the build or clear the cache and restart afterward.

**Why:** The dev watcher and production build can replace each other's manifests, causing transient `ENOENT` responses and exhausting file watchers.

**How to apply:** Keep development and production build output separate during verification, especially before browser checks.

Map tile requests have a separate preview constraint: proxy OpenStreetMap tiles through the app's origin, and use a browser-compatible `Mozilla/5.0` upstream header; a custom bot-style User-Agent can make OSM return a blank 103-byte PNG.

**Why:** The embedded preview can block direct third-party tile requests, while OSM may silently serve an empty tile to the custom proxy identity.

**How to apply:** Keep Leaflet's tile URL relative (`/api/map-tiles/{z}/{x}/{y}.png`) and cache the proxied PNG response.