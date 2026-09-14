---
name: Aiven connection budget
description: Shared Aiven PostgreSQL connection limits for preview and production app instances
---

Each app instance must use a conservative PostgreSQL pool because preview and production can point at the same Aiven database, whose `max_connections` also includes provider-managed background connections. Label application connections by environment and keep an idle-in-transaction timeout enabled.

**Why:** Aiven may reserve a substantial portion of a small instance's connection budget for internal services. Separate app pools with a default of ten connections can exhaust the database even when each process looks healthy in isolation.

**How to apply:** Before increasing `DB_POOL_MAX`, inspect `pg_stat_activity` across all client addresses and environments. Prefer a small default pool, an explicit per-environment `application_name`, and a bounded `idle_in_transaction_session_timeout`; raise the pool only with measured headroom. For Minh latency benchmarks, measure inbound persistence, history reads, and agent execution separately, and run sequential samples before testing concurrency so DB contention is not mistaken for provider latency.