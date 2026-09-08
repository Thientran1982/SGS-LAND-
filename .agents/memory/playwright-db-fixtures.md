---
name: Playwright DB-backed visual fixtures
description: External database-backed browser fixtures must avoid parallel setup when the shared database has limited connection slots.
---

Use a single-connection fixture pool and run DB-backed visual projects with one worker when the environment shares a small external PostgreSQL connection budget.

**Why:** Parallel desktop/mobile projects can exhaust the shared database before the browser reaches the page, producing misleading visual-test failures.

**How to apply:** Keep fixture setup bounded and prefer deterministic, network-independent image data; separate browser dependency failures from renderer assertions.