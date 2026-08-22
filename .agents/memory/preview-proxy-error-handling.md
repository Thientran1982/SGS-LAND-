---
name: Preview proxy error handling
description: The preview proxy receives different response object types for HTTP and WebSocket failures.
---

The `http-proxy` error callback may receive an `http.ServerResponse` for normal requests or a `net.Socket` during a failed WebSocket upgrade. Error handling must feature-detect `writeHead`/`end` and destroy sockets instead of assuming every object is an HTTP response.

**Why:** During startup, the proxy can attempt to forward before Next.js listens. Calling `writeHead` on the WebSocket socket crashes the proxy process and presents a blank Replit preview even though the application later starts correctly.

**How to apply:** Keep proxy error handling non-fatal, restart/reload after the target becomes available, and validate both the proxied health endpoint and browser preview after workflow restarts.