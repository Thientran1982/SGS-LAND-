---
name: Product information architecture
description: SGS LAND has separate customer, CRM, and agent-governance workspaces; user-facing navigation should be organized by jobs, not backend routes or tool names.
---

The product should expose three distinct information architectures: customer jobs (buy/rent/projects/value/knowledge/consign), CRM work (sales/inbox/marketing/analytics), and staff-only agent operations (runtime/policy/evaluation/audit). Do not use the route registry or tool manifest as the user-facing menu.

**Why:** Public Vite/Next shells, duplicate project/news routes, and a 40-item role menu currently make the same job appear in multiple places and mix customer actions with platform administration.

**How to apply:** Establish route ownership and canonical aliases first, then drive menus from role/capability metadata with a small set of primary destinations. Keep backend specialist/tool names behind staff-only details.

Minh should be presented as one goal-oriented assistant with progressive disclosure: natural-language Ask Minh, a short set of goal shortcuts, contextual next actions, and a separate attachment purpose choice. Lead capture and booking should appear only when the user chooses a consequential action.

**Why:** The public widget currently hides its identity/status, requires lead capture before exploration, exposes technical processing phases, and silently turns attachment-only messages into landing-page creation.

**How to apply:** Keep read-only chat low-friction, render source/result cards safely, show per-file readability, and request contact consent at quote/booking/escalation boundaries.