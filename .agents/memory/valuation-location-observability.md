---
name: Valuation location observability
description: Privacy and review rules for unknown valuation locations and aliases
---

Unknown valuation locations must remain explicit reference estimates: record only categorical missing hierarchy levels, a report-safe stable key, and fallback status. Never persist raw addresses or price values in the signal.

**Why:** Missing hierarchy coverage can silently select a regional baseline that looks precise, while raw address telemetry creates an unnecessary sensitive-location store.

**How to apply:** Keep unknown-location reporting tenant-scoped, use one-way grouping keys for repeated misses, and require an approved tenant alias before it can influence comparable matching.