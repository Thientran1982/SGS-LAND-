---
name: Vite detail navigation
description: The Vite CRM app uses hash-based client routing for listing detail pages.
---

Vite listing detail links must preserve the `#/...` hash route instead of navigating to a plain pathname.

**Why:** The preview/server treats a plain `/listing/...` URL as a server request, so it returns 404 before the SPA router can render the detail page.

**How to apply:** When sharing or reusing listing cards between Vite surfaces, generate hash URLs or use the existing hash navigation helper; do not replace them with Next.js pathname links.