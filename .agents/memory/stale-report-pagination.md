---
name: Stale report pagination
description: The consistency rule for loading stale publication reports while the underlying publication and listing data changes.
---

Stale publication review uses a keyset cursor ordered by creation time and publication ID. The first page establishes the operator's review window; later pages must continue after its last row rather than using an offset that can shift when new publications arrive or listing eligibility changes.

**Why:** Offset pagination can repeat the page boundary or skip an older publication when the stale-only result set changes between requests. Newly created publications are intentionally picked up by refreshing the report instead of changing the current review window.

**How to apply:** Keep the cursor comparison aligned with the exact `(created_at DESC, id DESC)` ordering, preserve tenant and stale-only predicates on every request, and deduplicate appended UI rows by publication ID.