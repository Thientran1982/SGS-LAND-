---
name: GEO monitor evidence
description: GEO performance snapshots must distinguish measured, skipped, and error states and retain the external measurement source.
---

Never turn an unavailable GEO measurement into a zero score. Store the provider, strategy, timestamp, response status, and per-page error alongside measured category scores.

**Why:** AI visibility and performance metrics are easy to overstate when a provider is unavailable or rate-limited; explicit provenance keeps the dashboard auditable.

**How to apply:** Use the same measured/skipped/error contract for future AI, SERP, backlink, and PageSpeed probes.