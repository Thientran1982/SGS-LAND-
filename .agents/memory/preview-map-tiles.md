---
name: Preview map tile policy
description: Replit Preview may render third-party map-host policy placeholders even when direct requests work outside the iframe.
---

Map tiles used inside the Replit Preview iframe should be fetched through a same-origin server proxy. Do not rely on a client-side third-party tile fallback; policy-block placeholder images can look like valid 200 responses and obscure the real map failure. CARTO's light_all tiles are the verified upstream for this project.

**Why:** The embedded browser can apply resource policy differently from a normal browser, and OSM/CARTO hosts may return an “Access blocked” image instead of a usable tile.

**How to apply:** Keep Leaflet tile URLs same-origin and have the server fetch CARTO light_all tiles with an explicit user agent. Use a cache-busting query only when replacing an already shipped client bundle.