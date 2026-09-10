---
name: Social publication tenant type boundary
description: Social publication tenant IDs are stored as varchar while core listing tenant IDs are UUIDs.
---

When social publication queries join publication rows to core listings, compare the tenant columns through text rather than directly; the publication table uses varchar and listings use UUID.

**Why:** A direct UUID-to-varchar tenant comparison fails at PostgreSQL parse time and can reject the whole publication-loading request, which also prevents the frontend from applying the separately loaded listing results.

**How to apply:** Keep tenant scoping in every join and predicate, but cast the UUID side to text for joins against social publication rows. Add a database-backed regression when changing either schema.