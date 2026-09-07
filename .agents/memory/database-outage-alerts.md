---
name: Database outage alerts
description: Database health remains local while shared Redis coordination deduplicates tenant-independent outage signals.
---

Database outage alerting must use a bounded in-process health transition and a non-database operational sink. Cross-instance deduplication may use a bounded Redis incident state, but Redis failures must fail open without changing local health or recovery behavior.

**Why:** The outage is precisely when database-backed notifications can fail, and connection errors may contain credentials or deployment details.

**How to apply:** Atomically claim one active incident, atomically resolve it once, retain resolved state briefly, and let the bounded active lease expire. Configure the threshold through environment and keep alert payloads limited to fixed service/component, timestamps, duration, threshold, and failure count fields.