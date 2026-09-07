---
name: Database outage alerts
description: Database availability alerts must remain process-local and tenant-independent while the database is unavailable.
---

Database outage alerting must use a bounded in-process health transition and a non-database operational sink; never persist the alert through the unavailable database or include raw connection/request context.

**Why:** The outage is precisely when database-backed notifications can fail, and connection errors may contain credentials or deployment details.

**How to apply:** Deduplicate on the unavailable-to-recovered lifecycle, configure the threshold through environment, and keep alert payloads limited to fixed service/component, timestamps, duration, threshold, and failure count fields.