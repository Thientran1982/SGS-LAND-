---
name: User-scoped connector ownership
description: Connector credentials and sync history belong to one authenticated user inside one tenant.
---

Connector configurations and their sync jobs must always be scoped by both tenant and owner user. A missing owner is not a shared connector: it is inaccessible until an authorized admin explicitly reassigns it.

**Why:** Credentials are private per user, while tenant-only filtering allows another user in the same tenant to inspect, check, mutate, delete, or sync someone else's connection.

**How to apply:** Pass the authenticated user id through every connector and sync route/repository operation, keep credentials redacted, and preserve orphaned rows with `ON DELETE SET NULL` rather than silently transferring ownership.