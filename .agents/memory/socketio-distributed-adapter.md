---
name: Socket.IO distributed adapter
description: Requirements for sharing chat-room membership and broadcasts across backend processes
---

Multi-process Socket.IO chat rooms require an explicit TCP Redis adapter URL. Upstash REST credentials cannot provide the pub/sub transport needed by `fetchSockets()` and remote room operations.

**Why:** The in-memory adapter only sees sockets in its own process, so membership revocation can leave a remote process delivering stale room messages.

**How to apply:** Keep single-process development on the in-memory adapter, use separate publisher/subscriber clients when `SOCKET_IO_REDIS_URL` is configured, and validate revocation with real child processes plus PostgreSQL membership rows. Never infer the TCP URL from REST Redis settings.

Membership revocation must delete the tenant-scoped database row first, then use a
server-side signal carrying only tenant, room, and user identifiers so every
process removes matching sockets. Missing sockets and leave failures are
non-fatal because the database row and the next broadcast membership check are
authoritative.

**Why:** A client can disconnect during an admin action, and treating that
transport race as a failed mutation would report a false failure after access has
already been revoked.

**How to apply:** Keep the revocation handler tenant- and user-matched before
calling `leave`, and never include message content or other room data in the
cross-process payload.

Redis adapter readiness must require both pub/sub clients to be `ready`; room
broadcasts fail closed while either client is unavailable, and an adapter
generation check discards in-flight operations that cross an outage/recovery.

**Why:** ioredis can queue an operation during a disconnect and resolve it
after reconnect. Emitting that stale operation would make recovery look
healthy while delivering an old message late or inconsistently.

**How to apply:** Expose bounded adapter state in readiness health, skip
distributed room work while degraded, and compare the captured generation
after every awaited adapter lookup before emitting.