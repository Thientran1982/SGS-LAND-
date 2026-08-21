---
name: Project ownership boundaries
description: Cross-tenant authorization rules for project-owned resources
---

Project-owned resources such as listing access and price-matrix rows must be authorized through the parent project or listing tenant, not only by the child resource ID and authenticated role.

**Why:** Child IDs can be valid across tenants, and role checks alone do not establish ownership. Parent-resource checks prevent an admin from reading or mutating another tenant's project data.

**How to apply:** Every project accessory endpoint should verify the parent belongs to the caller's tenant and include both tenant and parent identifiers in read, update, delete, and lookup queries.