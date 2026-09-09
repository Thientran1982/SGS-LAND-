---
name: Connection gateway safety
description: Tenant-scoped API and MCP connection management must fail closed and distinguish configuration checks from live provider verification.
---

Admin connection flows must derive tenant scope from the authenticated user, reject non-admin mutations, redact credentials from client responses, and label configuration-only checks separately from live provider readiness.

**Why:** A default tenant fallback or a raw connector config response can cross tenant boundaries or expose provider credentials; claiming a legacy config check is a live connection also enables unsafe publishing decisions.

**How to apply:** Keep tenant predicates on every MCP CRUD/test query, keep secrets server-side, and only mark a social capability ready after a provider-specific adapter verifies the account, permission, and response contract.