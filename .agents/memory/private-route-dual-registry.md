---
name: Private CRM route dual registry
description: Deep links for private CRM pages need matching Vite and Next proxy route entries.
---

Private CRM routes are defined in two places: the root Vite route registry used by the SPA and the Next.js `PRIVATE_PREFIXES` list used to proxy deep links to Express. Adding only the SPA route produces a Next.js 404 on a direct preview/deep link.

**Why:** The public preview is served by Next.js while the authenticated CRM UI is served by the Vite/Express app behind Next rewrites, so the two routing layers can drift independently.

**How to apply:** For every new authenticated CRM route, update both route registries, the Next proxy prefix list, the SPA page registry/prefetch map, and the role-specific navigation menu before testing a direct URL.