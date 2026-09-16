---
name: Live-chat browser smoke prerequisites
description: Environment constraints for the authenticated live-chat Playwright smoke test
---

Database-backed browser smoke tests need a reachable Aiven development hostname, a Chromium runtime with its system libraries, and a direct fixture pool capped at one connection because the running backend already consumes the database pool budget. In this Replit workspace, the Chromium system libraries must be declared in `.replit` Nix packages; otherwise Chromium fails before the app starts. Browser mutation helpers must fetch `/api/csrf-token` and send `X-CSRF-Token`; status polling may legitimately return `503 PROCESSING` during Aiven contention, but must never turn an accepted inbound into `NOT_FOUND`.

**Why:** A valid application can still make the smoke test fail before its assertions when the test runner cannot launch Chromium or Aiven reserves all remaining non-superuser connection slots.

**How to apply:** Keep the test skipped only when the database URL is absent or clearly invalid; otherwise treat browser/runtime and connection-slot errors as environment setup failures rather than product assertions. Keep the Nix dependency list with the smoke-test environment, use the real CSRF/cookie flow through the public proxy, and accept transient `503 PROCESSING` while rejecting `NOT_FOUND` after a `202`.