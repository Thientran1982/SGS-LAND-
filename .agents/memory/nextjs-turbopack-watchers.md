---
name: Next.js Turbopack watcher exhaustion
description: Development preview can fail with ENOSPC and misleading missing React module errors after repeated restarts.
---

When Next.js Turbopack reports `ENOSPC: System limit for number of file watchers reached`, the missing React/Recharts module messages are usually secondary resolver failures, not dependency corruption.

**Why:** Repeated preview restarts can leave development cache watcher state in a bad condition even when the configured inotify limits appear sufficient.

**How to apply:** Stop stale app processes, remove only `apps/nextjs/.next`, then restart the existing application workflow before debugging application imports.