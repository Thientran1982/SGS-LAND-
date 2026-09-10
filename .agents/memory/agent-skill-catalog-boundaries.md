---
name: Agent skill catalog boundaries
description: Security and runtime boundary for tenant skill records
---

The agent skill catalog is a tenant-scoped catalog, not automatically an executable runtime. Skill creation and publication are manager operations; installation may target the current tenant or a published PUBLIC skill, never another tenant's PRIVATE record.

**Why:** A stored prompt template can look like an active capability while no runtime consumes it, and unrestricted public/private mutations can leak or corrupt tenant-owned agent configuration.

**How to apply:** Keep catalog authorization and runtime activation separate. If catalog skills become executable, add an explicit governed loader with tenant scope, versioning, approval, and provenance checks.