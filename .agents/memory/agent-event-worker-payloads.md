---
name: Agent event worker payloads
description: The serialization boundary between durable agent events and process-local realtime services
---

Durable agent event payloads must contain only JSON data. Process-local services such as Socket.IO are injected into the daemon worker and never serialized into QStash or database event payloads.

**Why:** QStash retries and database-backed events must survive process restarts and cross a JSON boundary; a live socket server cannot be serialized or restored from a job.

**How to apply:** When adding an event source, store tenant/entity/message identifiers and reconstruct or use process-local dependencies inside the worker handler.