---
name: Shared cache consistency
description: Cross-instance cache invalidation rules for Redis-backed public and knowledge data.
---

When Redis is reachable, an absent shared key is authoritative and must not fall back to an instance-local value. Local fallback is permitted only when Redis is unavailable, and its keys must retain the complete tenant scope.

**Why:** A remote invalidation deletes the shared key before another instance reads. Returning that instance's older local value on the resulting Redis miss keeps stale public or knowledge data visible despite a successful mutation.

**How to apply:** Preserve the distinction between a Redis hit, a confirmed Redis miss, and an outage whenever adding a cache consumer. Route all listing, project, document, and asynchronous listing updates through the shared invalidation hooks; validate cross-process behaviour against real Redis.