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

Schema drift must be treated as a first-class recovery case: the daily run ledger and publication target conflict keys need an idempotent repair, and duplicate historical rows must be surfaced rather than deleted. A failed or skipped backfill may be explicitly requeued, but unresolved, ambiguous, or already successful provider targets must still block a second submission.

**Why:** A missing PostgreSQL conflict index can fail before Facebook receives anything, while blindly retrying after an uncertain provider response can create duplicate public content.

**How to apply:** Keep repair migrations separate from application writes, count terminal daily attempts so a no-content tenant does not create a new skipped row every scheduler tick, and reuse the same audited backfill request when a safe retry is requested.

Catch-up date selection must handle both a failed request during the current posting window and a missed previous day after midnight; checking only the current local day after its end can miss the recovery window entirely.

**Why:** Vietnam-local midnight changes the logical day before a naive `23:59` check can run, especially when QStash is unavailable and the process restarts the next morning.

**How to apply:** Retry an existing `FAILED` request once the day's window opens, and before the next day's first window inspect the previous local calendar day; terminal `SKIPPED` results must remain bounded.