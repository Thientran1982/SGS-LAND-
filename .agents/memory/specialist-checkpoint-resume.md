---
name: Specialist checkpoint resume
description: Durable specialist checkpoints must be tied to the exact plan and input, with synthesis-safe output commits.
---

A specialist checkpoint is reusable only when its deterministic plan hash and input hash match the current request. Specialist output must be committed after guardrail checks and before synthesis so a synthesis failure can resume without rerunning provider tools.

**Why:** Replaying a changed plan can use stale evidence, while overwriting a successful specialist checkpoint during synthesis error forces unnecessary provider calls.

**How to apply:** Keep checkpoint writes fenced by the execution claim token; treat mismatches as a fresh specialist run and preserve successful specialist steps when later synthesis fails.