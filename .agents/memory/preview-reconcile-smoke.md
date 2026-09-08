---
name: Preview reconcile smoke coverage
description: Reconcile error contracts need coverage through the public preview proxy
---

Mutation error contracts such as HTTP 409 with a stable machine-readable code should be tested through the same preview proxy and authentication/CSRF middleware that operators use, not only through an isolated router.

**Why:** Router-level PostgreSQL tests can pass while the entrypoint, rewrite, cookie, or middleware stack changes the status or drops the error code before it reaches the operator.

**How to apply:** Keep a disposable, tenant-scoped fixture and assert concurrent conflict responses plus cross-tenant 404/no-audit behavior through the public preview URL.