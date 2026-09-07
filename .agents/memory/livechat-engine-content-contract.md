---
name: Live-chat engine content contract
description: Durable execution validates live-chat results through content even when callers also expose response.
---

Live-chat engine results consumed by durable execution must keep the customer-facing text in `content`; `response` may remain as a compatibility alias.

**Why:** The durable output guardrail validates `content` and blocks otherwise successful tool results as empty output.

**How to apply:** When adding or changing a live-chat engine wrapper, return both fields with the same sanitized customer-facing text before handing the result to `runDurableAgentExecution`.