---
name: Authenticated QA prerequisites
description: Prerequisites for completing signed-in responsive release checks in this workspace
---

Authenticated Overview release evidence cannot be inferred from an unauthenticated route-boundary preview or component tests. It requires a usable signed-in account and a browser runtime that can launch Chromium with its system libraries available.

**Why:** A prior release pass reached the login redirect, while Playwright Chromium exited before page creation because `libglib-2.0.so.0` was unavailable; claiming responsive interaction results would have been misleading.

**How to apply:** Before attempting the device checklist, confirm both prerequisites independently. If either is absent, retain blocked checklist entries and attach only clearly labeled route-boundary or automated evidence.