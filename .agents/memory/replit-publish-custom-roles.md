---
name: Replit Publish custom roles
description: Replit-managed Publish database restores may not carry custom PostgreSQL roles used by external-database RLS.
---

Replit-managed production database provisioning does not automatically replicate custom PostgreSQL roles from an external database. A schema dump containing policies such as `TO sgs_app` can fail during Publish with `role "sgs_app" does not exist`.

**Why:** SGS-LAND's canonical database is external Aiven, while Replit's Publish flow may still inspect a separate managed development database. Creating the role or weakening policies in the app's external database does not repair the managed restore path.

**How to apply:** For an external-database app, skip or unlink Replit-managed database schema synchronization when the Publish UI permits it. Do not change RLS policies from the dedicated role to PUBLIC and do not add deploy-time DDL. If the UI has no external-database path, treat the failure as a Replit provisioning limitation and escalate rather than mutating the canonical database.