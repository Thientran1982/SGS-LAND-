---
name: Agent skill catalog boundaries
description: Security and runtime boundary for tenant skill records
---

The agent skill catalog is a tenant-scoped catalog, not automatically an executable runtime. Skill creation, publication, and runtime activation are manager operations; installation may target the current tenant or a published PUBLIC skill, never another tenant's PRIVATE record. Only an ACTIVE agent-skill binding can affect a runtime prompt; catalog installation alone must not do so.

**Why:** A stored prompt template can look like an active capability while no runtime consumes it, and unrestricted public/private mutations can leak or corrupt tenant-owned agent configuration. Silent activation on install would also change live agent behavior without an explicit manager decision.

**How to apply:** Keep catalog install and runtime activation separate. The runtime loader should read only ACTIVE bindings, scope both agent and skill to the current tenant (or a published PUBLIC source), preserve version metadata, bound prompt length, and never bypass guardrails or approval policy.