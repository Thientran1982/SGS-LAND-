---
name: Next.js Public Site Setup
description: How the Next.js public website (apps/nextjs/) is started and accessed in dev
---

## Rule
The primary Replit preview runs the Next.js public site on port 5000 and Express internally on port 5001. The separate "Next.js Public Site" workflow can run Next.js on port 3001.

- **Start application**: starts Express on port 5001, then Next.js on port 5000 for the main preview.
- **Next.js Public Site**: optional standalone Next.js server on port 3001.

**Why:** The main preview was changed to put the public Next.js app in front of Express; older setup notes incorrectly identified port 5000 as the Express UI.

## How to apply
- For changes to `apps/nextjs/`, restart "Start application" to verify the main preview. Use "Next.js Public Site" only when testing its separate port-3001 server.
- The Next.js app proxies `/api/*` to Express port 5001 through `BACKEND_URL` rewrites.
- Check the configured workflow before debugging ports; do not assume port 3001 is the main preview.
- Every new private CRM route must also be added to `apps/nextjs/config/routes.ts` and `PRIVATE_PREFIXES`; otherwise a direct preview URL can be handled by Next.js and return 404 before the CRM router runs.

## Client Components requirement
ANY component in `apps/nextjs/` that uses event handlers (onMouseEnter, onClick, etc.) OR React hooks (useState, useEffect) MUST have `"use client"` as the FIRST directive after any `// @ts-nocheck` comment.

Without `"use client"`, RSC will throw: "Event handlers cannot be passed to Client Component props"

**Affects:** PublicHeader, PublicFooter, LandingPage — all must be Client Components.
