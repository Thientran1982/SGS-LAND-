---
name: Sequence worker advisory locks
description: PostgreSQL advisory locks for sequence delivery must stay attached to one checked-out session for the entire worker run.
---

PostgreSQL advisory locks are session-scoped, so a worker must acquire, process, and release its lock through the same database client. A pool-level query can silently move later work to another session and remove the concurrency guarantee.

**Why:** Concurrent scheduler processes must not both claim and send the same enrollment step.

**How to apply:** When changing sequence worker execution, retain one checked-out client around lock, claims, state updates, and unlock; cover competing workers with a PostgreSQL integration test.