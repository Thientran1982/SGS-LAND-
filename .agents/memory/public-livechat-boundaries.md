---
name: Public live-chat security boundaries
description: Ownership, attachment provenance, retry identity, and durable response rules for public Minh chat.
---

Public live-chat identifiers are capabilities only when bound to a signed visitor session or verified account; a caller-supplied lead UUID must not authorize history, uploads, Socket.IO rooms, AI runs, or status reads.

**Why:** The public endpoints otherwise allow conversation disclosure, assistant-message/metadata spoofing, fabricated document context, and cross-run retry ambiguity even when database queries remain tenant-scoped.

**How to apply:** Bind every public operation to one server-issued session/identity, accept only server-controlled direction and metadata, verify attachment IDs and provenance, include the complete multimodal input in durable idempotency, and make outbound persistence/failure state part of the durable response lifecycle.