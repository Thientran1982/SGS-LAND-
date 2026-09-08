---
name: Database outage alerts
description: Database health remains local while shared Redis coordination deduplicates tenant-independent outage signals.
---

Database outage alerting must use a bounded in-process health transition and a non-database operational sink. Cross-instance deduplication may use a bounded Redis incident state, but Redis failures must fail open without changing local health or recovery behavior.

Process-level handlers for transient database errors must be installed before migrations or background workers start. A pg DNS/socket error can be emitted outside the originating promise during startup, before request-level error handling exists.

PostgreSQL `53300` (`too_many_connections`) and its connection-slot messages should be treated as transient, and shared preview/production processes need explicit pool headroom rather than each assuming the full service limit.

**Why:** Preview and production can point at the same managed database; one process using the entire connection budget can prevent the other from opening its health or migration connections.

**How to apply:** Keep the pool bounded below the provider limit, leave the value configurable, and let startup retry connection-slot exhaustion without classifying it as a permanent SQL failure.

**Why:** The outage is precisely when database-backed notifications can fail, and connection errors may contain credentials or deployment details.

**How to apply:** Atomically claim one active incident, atomically resolve it once, retain resolved state briefly, and let the bounded active lease expire. Configure the threshold through environment and keep alert payloads limited to fixed service/component, timestamps, duration, threshold, and failure count fields.