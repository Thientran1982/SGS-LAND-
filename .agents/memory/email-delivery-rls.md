---
name: Email delivery claim RLS
description: Internal email idempotency records must support controlled worker writes without weakening tenant isolation
---

Email delivery claim tables are written by trusted workers without a user tenant context. Their RLS policy must allow the app's explicit, transaction-scoped bypass flag while still requiring tenant matching for normal requests.

**Why:** An idempotent email send can fail before reaching Brevo if the claim insert is rejected by RLS; this is especially easy to miss because the failure appears as a generic delivery failure.

**How to apply:** Whenever adding or changing an internal delivery/outbox table, define both `USING` and `WITH CHECK` for the bypass path, grant DML to the runtime role, and verify the claim insert before testing provider delivery.