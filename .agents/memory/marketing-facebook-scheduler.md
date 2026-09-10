---
name: Marketing Facebook scheduler
description: Daily Facebook agent timing and reliability boundary
---

The Marketing Facebook agent owns one tenant-scoped run per Vietnam calendar day and schedules its in-process fallback at 18:30 Asia/Ho_Chi_Minh. Exact execution while the app is asleep requires an external scheduler to call the authenticated internal cron route.

**Why:** An in-process timer cannot run while the VM or application process is stopped; the daily ledger prevents duplicate work when both timers and external triggers reach the same day.

**How to apply:** Keep the tenant/day ledger as the idempotency boundary. Treat an external 18:30 trigger as the production reliability path and the in-process timer as a live-process fallback.

Controlled backfills must create one tenant/day request with an operator reason and actor, reuse the daily ledger row, and stop when the previous Facebook target is ambiguous or still unresolved. They must not create a second provider submission for an already successful day.

**Why:** Recovery after QStash or deployment outages needs an auditable operator path, but Facebook cannot prove whether an uncertain request was accepted, so a blind recovery retry can duplicate public content.

**How to apply:** Allow a backfill to bypass the normal time window only after validating the requested historical day; preserve the publication auto key and expose the request result/status to operators.