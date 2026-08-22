---
name: Live-chat regression fixture
description: Stable public project identifier for live-chat project-info regression checks
---

The public host tenant has a stable `mcc` project fixture suitable for exercising found-project behavior in live-chat API regression tests. Optional tenant-specific project-code environment variables can be absent or point to a missing project, so they should not be the only input to a test that needs a successful response.

**Why:** A malformed project-info test previously accepted 404 when its optional project code was unset, allowing it to skip the listing-limit assertion entirely.

**How to apply:** Use `mcc` for the found-project request, and keep a separate deliberately missing code assertion for the no-data/404 path.