---
name: Replit Publish custom roles
description: Replit-managed Publish database restores may not carry custom PostgreSQL roles used by external-database RLS.
---

Replit-managed production database provisioning does not automatically replicate custom PostgreSQL roles from an external database. A schema dump containing policies such as `TO sgs_app` can fail during Publish with `role "sgs_app" does not exist`.

**Why:** SGS-LAND's canonical database is external Aiven, while Replit's Publish flow may still inspect a separate managed development database. Creating the role or weakening policies in the app's external database does not repair the managed restore path.

**How to apply:** For an external-database app, turn off `Create production database` in Publishing settings (or use the external-database path) so Replit does not restore its managed schema. Do not change RLS policies from the dedicated role to PUBLIC and do not add deploy-time DDL. If the UI has no such option, treat the failure as a Replit provisioning limitation and escalate rather than mutating the canonical database.

## Extensions in Publish validation

Publish validation may restore a schema snapshot into a fork without running the application's migration runner or carrying cluster-level extensions. A live Aiven database can have `pg_trgm` installed and still fail validation when a restored GIN index references `gin_trgm_ops`.

**Why:** PostgreSQL extensions are database/cluster state, while the application's `schema_versions` migration path is separate from Replit's dump/restore validation path.

**How to apply:** Verify `pg_available_extensions` and `pg_extension` on the canonical Aiven service, then treat a fork-only `gin_trgm_ops` failure as a Publish restore limitation. Do not alter the index or add production startup DDL; use an external-database Publish path or escalate the restore behavior.

## Validation database drift

The Replit-managed validation database can lag the external Aiven migration registry even when Aiven is fully current. Replay the application migrations against the validation database with its native connection settings before treating the fork as broken.

**Why:** The application pool intentionally enforces Aiven TLS, while the internal validation PostgreSQL may reject SSL; using the production pool configuration against the fork can look like a migration failure when it is only a connection mismatch.

**How to apply:** Confirm both databases independently, run a dry-run first, then apply the pending migration batch only to the validation database. Never use this to mutate Aiven production or weaken custom-role RLS policies.