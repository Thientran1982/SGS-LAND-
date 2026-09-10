---
name: Listing multi-status filters
description: The listing API distinguishes a single status from a comma-separated set of statuses.
---

For listing selectors that need several eligible statuses, send the plural status filter and translate it to the repository's `status_in` condition. Do not pass a comma-separated value through the singular `status` filter.

**Why:** The singular route filter generates an equality condition, so a value such as `AVAILABLE,OPENING,BOOKING` silently returns no rows and makes downstream selectors appear empty.

**How to apply:** When adding an inventory picker or eligibility query, use the route's plural multi-status parameter and keep a regression test for the query-to-repository translation.