---
name: Dashboard layout structure
description: The authenticated Vite overview follows the Design Tool's block hierarchy while retaining production analytics.
---

The overview hierarchy is intentionally: hero, priority attention, quick actions, work queue, setup guide, KPI cards, pipeline plus market pulse, activity plus project breakdown, performance cards, then inbox plus demand. Keep analytics panels independent rather than nesting unrelated sections inside one workbench.

**Why:** The Design Tool reference is a composition system, not just a color reference; nesting panels changes scan order and makes the production screen feel like a different product.

**How to apply:** New overview widgets should join the nearest semantic row and remain separate cards. Preserve the shared responsive grid and keep non-overview CRM routes on their existing shell.