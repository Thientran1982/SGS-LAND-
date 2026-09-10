---
name: Agent skill catalog boundaries
description: Security and runtime boundary for tenant skill records
---

The agent skill catalog is a tenant-scoped catalog, not automatically an executable runtime. Skill creation, publication, and runtime activation are manager operations; installation may target the current tenant or a published PUBLIC skill, never another tenant's PRIVATE record. Only an ACTIVE agent-skill binding can affect a runtime prompt; catalog installation alone must not do so.

**Why:** A stored prompt template can look like an active capability while no runtime consumes it, and unrestricted public/private mutations can leak or corrupt tenant-owned agent configuration. Silent activation on install would also change live agent behavior without an explicit manager decision.

**How to apply:** Keep catalog install and runtime activation separate. The runtime loader should read only ACTIVE bindings, scope both agent and skill to the current tenant (or a published PUBLIC source), preserve version metadata, bound prompt length, and never bypass guardrails or approval policy.

Public skill mutations must invalidate runtime prompt caches for every tenant with an ACTIVE binding to that skill, including bindings that become ineligible after unpublish. The cross-tenant lookup may return tenant IDs only through a SELECT-only privileged RLS policy; prompt contents remain tenant-scoped.

**Why:** A process-local cache can retain a fully assembled prompt after the public source changes, while broad RLS bypass would create an unnecessary path to cross-tenant binding mutations or prompt data.

**How to apply:** Query by skill ID and ACTIVE status, always include the owner as a safe fallback, clear each tenant's local prompt cache, and let the runtime loader enforce public visibility when it refetches.