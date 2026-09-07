---
name: Rate-limit fallback timeouts
description: Redis-backed rate limiting must bound both client initialization and command execution.
---

Any Redis-backed rate-limit middleware must timeout the complete dependency path, including lazy client initialization and the `INCR/EXPIRE` operation, before using the existing in-memory fallback.

**Why:** A timeout around only the Redis command still leaves requests hanging when lazy Upstash client creation or module loading stalls first.

**How to apply:** Keep the rate-limit algorithm and middleware order unchanged; bound both awaits, emit a cooldown-limited warning, and preserve the same in-memory counting semantics.