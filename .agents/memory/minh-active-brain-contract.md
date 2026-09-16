---
name: Minh active brain decision dossier
description: The minimum auditable dossier required before a proactive Minh opportunity can enter Suggest or approval flow.
---

Every proactive Minh opportunity must carry one validated decision dossier before it
can be called an active-brain decision or enter the Suggest queue.

**Why:** A rationale plus evidence was not enough to answer tenant scope, freshness,
specialist omissions, permission, duplicate safety, and rollback during operator review.

**How to apply:** Keep the dossier tenant-scoped and explicit about why/evidence/freshness,
specialists run and skipped, Read/Suggest/Act classification, approval, idempotency/replay
behavior, and the last-known-good or rollout-disable rollback target. Missing fields fail closed.