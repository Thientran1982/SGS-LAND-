---
name: Dev file watcher limit
description: Next/Turbopack and the mockup Vite workflow can exhaust Linux inotify watchers and surface false module-not-found errors.
---

When the preview shows Internal Server Error alongside `ENOSPC` or “OS file watch limit reached”, treat the missing-module messages as secondary. Stop stale mockup/dev watcher processes, then restart the single main application workflow and verify both frontend and backend ports with HTTP checks.

**Why:** The environment may retain failed mockup Vite processes after task merges; concurrent watchers exhaust inotify capacity and make healthy packages appear unresolved.

**How to apply:** Check workflow logs and active listeners before changing dependencies. Clean only stale development processes, restart once, and confirm the preview returns 200 with a clean browser console.