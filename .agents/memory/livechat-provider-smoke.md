---
name: Live-chat provider smoke evidence
description: Separate real-provider success evidence from cached persistence replay when validating live-chat memory
---

Live-chat acceptance has two distinct signals: an uncached provider call proves provider latency/status, while a cached replay proves persistence and idempotency. A replay cannot replace provider evidence, and a provider quota/outage cannot be treated as a persistence failure.

**Why:** Real smoke runs can hit provider quotas, transient model availability, or database connection limits after the durable execution has already been created. Mixing those signals leads to false conclusions about memory/journey behavior.

**How to apply:** Use schema-valid UUID fixtures, keep a stable session ID for both calls, record uncached provider evidence separately, and inspect memory/journey rows plus PII after the cached replay.