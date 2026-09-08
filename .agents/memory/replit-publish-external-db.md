---
name: Replit publish with external Aiven database
description: Replit publishing may clone the managed development database even when the app runtime uses Aiven.
---

When the app uses AIVEN_DATABASE_URL, Replit publishing can still enter database provisioning because a managed DATABASE_URL exists. If the development dump contains RLS policies targeting the custom sgs_app role, the production clone can fail before build with `role "sgs_app" does not exist`.

**Why:** The publish database-copy step is separate from the application's runtime connection. Updating AIVEN_DATABASE_URL does not prevent Replit from copying its managed development database.

**How to apply:** Do not retry indefinitely. Cancel the stuck publish, disable copying development data in publishing settings when production is external, and run the application's migrations against Aiven separately. If managed DB cloning is required, provision the target role before restoring policies.