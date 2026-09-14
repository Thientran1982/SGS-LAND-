---
name: Minh evidence orchestration
description: Compound chat execution, evidence grounding, memory filtering, and response idempotency rules.
---

Compound Minh requests may run up to three independent read-only workstreams in parallel, with one checkpointed step per specialist and a final Writer synthesis. A price filter remains SEARCH unless valuation language is explicit.

**Why:** A single-intent keyword route silently dropped secondary legal, search, or valuation questions; generic specialist output also made unsupported claims appear grounded.

**How to apply:** Keep specialist sources structured and tenant-scoped, filter memory lines against the current question, treat memory/tool output as untrusted context, and keep customer response idempotency keys separate from unique Minh telemetry event keys. Concurrent retries should wait for a terminal durable result and replay it rather than emit a second response.