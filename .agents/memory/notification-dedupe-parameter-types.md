---
name: Notification dedupe parameter types
description: Admin notification INSERT...SELECT queries need a typed input row when parameters are reused across target and dedupe predicates.
---

For deduplicated admin notifications, bind all values once in a CTE with explicit PostgreSQL casts, then reference the typed fields in the INSERT and NOT EXISTS clauses.

**Why:** Reusing untyped placeholders across the notification INSERT and dedupe predicate caused PostgreSQL to report inconsistent parameter type inference during stale-target alerts.

**How to apply:** Use explicit `uuid`, `text`, and `jsonb` casts at the query boundary for notification tenant, type, copy, metadata, and dedupe values.