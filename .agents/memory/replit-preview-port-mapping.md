---
name: Replit preview port mapping
description: Keep the main webview on one canonical public port when Next.js fronts the Vite/Express app.
---

The development preview must expose only the main Next.js listener through the canonical webview mapping. A second proxy listener mapped to another external port can make Replit generate or retain a `replit.dev:<port>` URL, even when the main app already serves correctly without a port.

**Why:** Replit chooses among exposed workflow ports for preview navigation; a redundant proxy mapping can look like an application redirect and make cross-app reload behavior appear broken.

**How to apply:** Keep Next.js on local port 5000, proxy backend/Vite on an internal-only port such as 5001, and remove redundant public preview proxy mappings unless there is a demonstrated need.