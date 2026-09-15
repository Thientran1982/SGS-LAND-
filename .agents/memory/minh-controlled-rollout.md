---
name: Minh controlled rollout
description: Week 4 rollout and learning boundary for proactive decision suggestions.
---

Automatic proactive suggestions must be gated by the tenant capability rollout. Canary selection is deterministic from the source signal, while explicit staff Suggest remains an intentional approval request. Learning telemetry stores categorical outcomes only; raw answers and provider payloads stay out.

**Why:** A shadow detector can safely observe many tenants, but converting every observation into an approval queue item creates review load and makes it hard to compare operator outcomes across controlled cohorts.

**How to apply:** Fail closed for missing/inactive capability rows, keep the existing tenant/day budget and source-signal dedupe, and treat learning-write failures as non-blocking operational degradation.