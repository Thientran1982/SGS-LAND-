---
name: Live-chat DB preparation resilience
description: Runtime safeguards for public Minh preparation when shared PostgreSQL pool capacity is temporarily exhausted
---

Public Minh requests already persist the inbound interaction before the AI endpoint starts. The normal path should reuse that interaction from the history read instead of opening a third RLS transaction, and transient PostgreSQL pool-acquisition failures should receive bounded retry with backoff before becoming a terminal reply failure. Terminal degraded replies must retain the original inbound correlation so the widget can offer a retry without creating a duplicate inbound message.

**Why:** Preview, production, and background schedulers can contend for a small shared Aiven connection budget. A single `pg-pool` acquisition timeout otherwise turns a successfully stored customer question into a misleading `AI_UNAVAILABLE` bubble.

**How to apply:** Keep the live-chat preparation path connection-light, classify `timeout exceeded when trying to connect` as transient, and preserve outbox/idempotency state across retries and degraded terminal responses.