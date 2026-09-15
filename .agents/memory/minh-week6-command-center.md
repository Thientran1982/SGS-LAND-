---
name: Minh Week 6 Command Center
description: Integration contract for the tenant-scoped five-panel operational dashboard.
---

The Command Center is served through the authenticated Minh Brain route and rendered in Agent Cockpit from one summary containing five independently stateful panels. Each panel must preserve `available`, `degraded`, or `unavailable`; do not collapse missing database data into zero.

**Why:** Minh operations need one consistent read-only view while individual database panels can fail independently under the constrained shared database connection budget.

**How to apply:** Keep all reads inside `withTenantContext`, fail closed for unknown approval actions, bound time-windowed metrics in SQL, and treat scheduler observations as observations rather than successful runs.