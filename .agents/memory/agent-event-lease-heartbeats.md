---
name: Agent event lease heartbeats
description: Long-running inbound handlers must renew their database event lease while processing
---

Inbound event claims use a short lease so crashed workers can be retried, but a live worker must renew that lease while AI/provider work is running.

**Why:** Without a heartbeat, a slow or temporarily blocked handler can be reclaimed by another process, causing concurrent execution attempts and duplicate side effects even when fencing protects final writes.

**How to apply:** Any durable event worker that can run longer than its lease interval should heartbeat with its lease token and stop/ignore work when renewal is no longer accepted; keep retry-after-crash behavior.