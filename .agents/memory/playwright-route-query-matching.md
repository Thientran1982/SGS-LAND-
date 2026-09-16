---
name: Playwright route query matching
description: Browser fixtures for query-bearing API requests need a wildcard after the path
---

Playwright route patterns that need to intercept both a bare path and its query string should include a trailing `**` after the path.

**Why:** A fixture route ending at `/resource` matched the initial request but let filtered `/resource?...` requests fall through to another handler, making request-order assertions misleading.

**How to apply:** Use a pattern such as `**/api/resource**` for filtered API endpoints, then assert decoded query parameters inside the handler.