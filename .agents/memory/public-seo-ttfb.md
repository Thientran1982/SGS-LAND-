---
name: Public SEO TTFB
description: Server-rendered Next public content should avoid same-origin proxy hops and use bounded public-data caching.
---

Server-side Next.js reads for public editorial and project content should prefer the internal backend URL, with the public URL only as a deployment fallback. Public content can use a short bounded Data Cache window when publication freshness is acceptable.

**Why:** Calling the public Next origin from server rendering sends the request back through rewrites before it reaches Express, adding avoidable latency to crawler-facing pages. A short cache removes repeated database work without inventing or persisting stale property facts indefinitely.

**How to apply:** Keep browser requests same-origin, but resolve server-only fetch bases from `BACKEND_URL` first, then `NEXT_PUBLIC_API_URL`. Use explicit revalidation/tags for public editorial data and preserve provenance gates for numeric project facts.