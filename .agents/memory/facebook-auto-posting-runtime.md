---
name: Facebook auto-posting runtime prerequisites
description: Durable database and asset-origin prerequisites for Marketing Facebook auto-posting
---

The Marketing Facebook daily ledger's unique key is a runtime idempotency boundary, not only migration metadata. A recorded migration does not prove that the unique index still exists; schema repair must restore the `(tenant, logical day, slot)` key before any `ON CONFLICT` claim runs.

**Why:** A long-lived external PostgreSQL database can drift after a migration is recorded, causing every scheduler tick to fail before source selection or provider delivery.

**How to apply:** When auto-posting reports `42P10` or repeated claim failures, inspect the live index first and repair it with a new idempotent migration. Preserve historical rows and deterministically relabel duplicate slots before recreating the index.

Facebook provider assets must be absolute HTTPS URLs. Relative upload paths are eligible only when an explicit public origin is configured; do not use the Replit development domain as a production URL.

**Why:** Facebook fetches assets outside the app session, and relative or preview-proxy URLs are not reliable provider inputs.

**How to apply:** Configure `PUBLIC_URL` from the verified deployment origin before enabling auto-posting, then verify the immutable asset snapshot and provider result.