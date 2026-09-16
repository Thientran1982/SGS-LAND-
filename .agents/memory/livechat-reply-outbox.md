---
name: Live-chat reply outbox
description: Durable state and response envelope rules for public Minh replies after asynchronous execution.
---

Public live-chat execution and reply delivery are separate durable steps. An accepted request must have a tenant-scoped pending reply record keyed by inbound interaction; only a persisted outbound interaction may transition it to delivered, and definitive async failures must create a failed outbound interaction.

**Why:** HTTP 202 and Socket.IO delivery can both be interrupted after the agent has finished, so execution success alone cannot prove that the customer received or can restore the reply.

**How to apply:** Keep status responses explicit (`PROCESSING`, `REPLY_PENDING`, `SUCCESS`, `BLOCKED`, `FAILED`) and persist content, sources, artifact, suggested action, intent, clarification, and correlation IDs in one response envelope used by history and retry reconciliation.