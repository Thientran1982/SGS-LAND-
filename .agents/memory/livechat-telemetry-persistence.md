---
name: Live-chat telemetry persistence
description: Durable, content-free Minh latency telemetry must survive restarts without adding pressure during database outages.
---

Persist only bounded, hashed latency samples and alert timestamps. Writes must be debounced and asynchronous, hydrate before operator metrics are served, and back off after database failures so telemetry cannot block chat or amplify an outage.

**Why:** Minh's process-local metrics disappeared on restart, while Aiven contention made synchronous or frequent telemetry writes risky for the live-chat path.

**How to apply:** Keep persistence separate from request acknowledgement, cap the rolling window, flush during graceful shutdown when possible, and treat a persistence failure as an operational warning rather than a chat failure.