---
name: Marketing Facebook scheduler
description: Daily Facebook agent timing and reliability boundary
---

The Marketing Facebook agent owns one tenant-scoped run per Vietnam calendar day and schedules its in-process fallback at 18:30 Asia/Ho_Chi_Minh. Exact execution while the app is asleep requires an external scheduler to call the authenticated internal cron route.

**Why:** An in-process timer cannot run while the VM or application process is stopped; the daily ledger prevents duplicate work when both timers and external triggers reach the same day.

**How to apply:** Keep the tenant/day ledger as the idempotency boundary. Treat an external 18:30 trigger as the production reliability path and the in-process timer as a live-process fallback.