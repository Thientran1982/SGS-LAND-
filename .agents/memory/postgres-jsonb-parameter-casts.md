---
name: PostgreSQL JSONB parameter casts
description: Migration query typing when parameters are passed to variadic JSONB builders.
---

PostgreSQL may reject an otherwise valid query when an untyped placeholder is passed directly to a variadic function such as `jsonb_build_object`, or reused for assignment and comparison; cast text placeholders explicitly at the SQL boundary.

**Why:** The database cannot always infer one type for a parameter used in multiple expression contexts, so the query can fail before any data change is applied even when the destination column is typed.

**How to apply:** Use explicit casts such as `$5::text` or `$2::varchar` at the SQL boundary, then run the query against the configured runtime database rather than relying only on mocks.