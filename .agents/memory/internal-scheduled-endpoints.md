---
name: Internal scheduled endpoint protection
description: Server-to-server cron endpoints must bypass browser CSRF checks only when protected by an internal secret.
---

Server-to-server scheduled POST endpoints need an explicit CSRF exemption because they do not have a browser double-submit token, while still requiring the internal secret header before any mutation.

**Why:** A secret-only endpoint otherwise returns a CSRF error before its intended authentication check, so valid scheduler calls silently fail.

**How to apply:** When adding an internal scheduler route, update the CSRF exemption list and keep constant-time secret validation in the route; never make the whole internal prefix unauthenticated.