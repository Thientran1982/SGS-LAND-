---
name: PostgreSQL JSONB parameter casts
description: Migration query typing when parameters are passed to variadic JSONB builders.
---

PostgreSQL may reject an otherwise valid migration when an untyped placeholder is passed directly to a variadic function such as `jsonb_build_object`; cast text placeholders explicitly at the SQL boundary.

**Why:** The database cannot infer a type for a parameter used only as a variadic JSONB value, so the migration fails before any data change is applied.

**How to apply:** In migrations, use explicit casts such as `$5::text` inside `jsonb_build_object` and similar variadic expressions, then run the migration against the configured runtime database.