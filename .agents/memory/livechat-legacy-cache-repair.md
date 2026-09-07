---
name: Live-chat legacy cache repair
description: A cached EMPTY_OUTPUT execution can outlive a guardrail fix and needs a narrowly scoped replay path.
---

When a live-chat execution was cached as `EMPTY_OUTPUT` before an output-contract fix, retry only landing-builder requests through a versioned repair idempotency key.

**Why:** Durable idempotency correctly preserves old results, but that also preserves a known-invalid response after the code is fixed.

**How to apply:** Keep ordinary chat replays unchanged; detect the legacy guardrail flag at the public landing boundary and repair once without blindly duplicating normal outbound sends.