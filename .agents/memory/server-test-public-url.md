---
name: Server test public URL
description: Server-side social URL tests must control the configured public origin explicitly.
---

Server tests that assert public URLs should set `APP_URL` explicitly; the Replit preview domain can otherwise override the expected production origin.

**Why:** The runtime resolves its public base URL from environment configuration, so a preview hostname makes otherwise unrelated URL assertions fail.

**How to apply:** Run URL-sensitive server tests with a fixed HTTPS `APP_URL`, while keeping provider image normalization tests that intentionally exercise missing or relative origins isolated.