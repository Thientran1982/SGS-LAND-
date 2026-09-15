---
name: Minh Week 5 promotion control
description: Model-promotion lifecycle, approval atomicity, and compatibility boundaries for the proactive learning loop.
---

Model promotion must remain fail-closed: the loop is off unless shadow mode is explicit, canary soak and sample gates must pass, and go-live/rollback always require staff approval. Weight state and candidate metadata must be changed through the same approval transaction so a partial promotion cannot leave the control plane inconsistent.

**Why:** A model candidate changes internal decisioning even without an external provider call; treating it like a normal background update would make rollback and audit unreliable.

**How to apply:** Reuse `approval_requests` with bounded categorical payloads, call the existing weight safeguards from the approval transaction, preserve a previous live weight version for the first candidate, and never add provider-side effects to the lifecycle.

Legacy proactive approvals may not contain the Week 5 evidence schema. Apply stale-opportunity revalidation only to schema-versioned detector approvals so older manual review contracts remain compatible.

**Why:** Existing approval fixtures and manually-created queue entries predate Week 5; forcing the new evidence contract onto them changes their observable execution behavior.

**How to apply:** New detector-generated approvals must carry the current evidence schema; treat unversioned legacy approvals through their existing review path while keeping tenant-scoped boundaries.