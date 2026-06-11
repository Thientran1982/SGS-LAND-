---
name: Next.js Public Site Setup
description: How the Next.js public website (apps/nextjs/) is started and accessed in dev
---

## Rule
The Next.js public site runs as a SEPARATE process from the main Express/Vite CRM.

- **Express CRM**: `npm run dev` from root → port 5000 → external port 80 (main preview pane)
- **Next.js Public Site**: `cd apps/nextjs && npm run dev` → port 3001 → workflow "Next.js Public Site"

**Why:** The root `server.ts` serves the Vite React CRM. Next.js is a separate app in `apps/nextjs/` with its own `package.json`, `node_modules`, and dev server.

## How to apply
- When making changes to `apps/nextjs/` components, restart the "Next.js Public Site" workflow (not "Start application")
- The Next.js app proxies `/api/*` → Express port 5000 (via next.config.ts rewrites)
- Port 3001 is configured in configureWorkflow; accessible at `https://3001-<REPLIT_DEV_DOMAIN>`
- `apps/nextjs/node_modules` must be installed separately: `cd apps/nextjs && npm install`

## Client Components requirement
ANY component in `apps/nextjs/` that uses event handlers (onMouseEnter, onClick, etc.) OR React hooks (useState, useEffect) MUST have `"use client"` as the FIRST directive after any `// @ts-nocheck` comment.

Without `"use client"`, RSC will throw: "Event handlers cannot be passed to Client Component props"

**Affects:** PublicHeader, PublicFooter, LandingPage — all must be Client Components.
