---
name: AI spend upsert reliability
description: AI spend aggregation depends on a tenant-scoped enterprise config key and atomic JSONB increments.
---

AI spend counters must be updated with a database-side atomic increment, not a read-modify-write from worker memory. Environments with historical migration drift also need an explicit unique index on `(tenant_id, config_key)` before using the upsert target.

**Why:** Worker restarts discard in-process buffers, and concurrent workers can lose increments or fail with “no unique constraint matching ON CONFLICT”.

**How to apply:** Preserve failed batches for retry, serialize flushes within a worker, and make schema repair migrations idempotent.