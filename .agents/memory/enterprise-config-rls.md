---
name: Enterprise config RLS typing
description: Tenant session settings are text values and may meet UUID columns through stale database policies.
---

Enterprise configuration RLS should compare `tenant_id::text` with the tenant session setting, rather than relying on an implicit UUID-to-varchar comparison.

**Why:** Existing databases can retain an older policy definition even after migration source code is corrected, causing platform catalog requests to fail with `operator does not exist: uuid = character varying`.

**How to apply:** When repairing tenant policies on UUID-backed tables that read `current_setting('app.current_tenant_id', true)`, replace the live policy explicitly and use a text comparison (while keeping the tenant scope and bypass conditions intact).