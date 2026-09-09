---
name: Playwright DB-backed visual fixtures
description: External database-backed browser fixtures must avoid parallel setup when the shared database has limited connection slots.
---

Use a single-connection fixture pool and run DB-backed browser projects with one worker when the environment shares a small external PostgreSQL connection budget. Only auto-enable database auth fixtures in CI (or with an explicit local opt-in); otherwise local runs should skip when no test credential is present.

**Why:** Parallel browser projects or the app's background workers can exhaust a shared database before the browser reaches the page, producing misleading UI failures. Local development should remain predictable rather than silently consuming shared database slots.

**How to apply:** Keep fixture setup bounded, cap the CI backend pool when needed, prefer deterministic network-independent test data, and separate browser dependency failures from renderer assertions.