---
name: Public home navigation
description: The public homepage is served by Next.js at root while the Vite shell owns authenticated routes.
---

Links from the Vite Login page to the public homepage must use a full-page navigation to `/`. Converting `#/home` inside the Vite router can leave the browser at `/home` because it bypasses the router handoff that serves the Next.js root page.

**Why:** The public and authenticated surfaces share a domain but are served by different route owners.

**How to apply:** Use `window.location.href = '/'` for Login’s back-home action; use the Vite route constants and client navigation only for authenticated CRM destinations.