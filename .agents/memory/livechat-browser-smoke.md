---
name: Live-chat browser smoke prerequisites
description: Environment constraints for the authenticated live-chat Playwright smoke test
---

Database-backed browser smoke tests need a reachable Aiven development hostname, a Chromium runtime with its system libraries, and a direct fixture pool capped at one connection because the running backend already consumes the database pool budget.

**Why:** A valid application can still make the smoke test fail before its assertions when the test runner cannot launch Chromium or Aiven reserves all remaining non-superuser connection slots.

**How to apply:** Keep the test skipped only when the database URL is absent or clearly invalid; otherwise treat browser/runtime and connection-slot errors as environment setup failures rather than product assertions.