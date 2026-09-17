---
name: Socket.IO distributed adapter
description: Requirements for sharing chat-room membership and broadcasts across backend processes
---

Multi-process Socket.IO chat rooms require an explicit TCP Redis adapter URL. Upstash REST credentials cannot provide the pub/sub transport needed by `fetchSockets()` and remote room operations.

**Why:** The in-memory adapter only sees sockets in its own process, so membership revocation can leave a remote process delivering stale room messages.

**How to apply:** Keep single-process development on the in-memory adapter, use separate publisher/subscriber clients when `SOCKET_IO_REDIS_URL` is configured, and validate revocation with real child processes plus PostgreSQL membership rows. Never infer the TCP URL from REST Redis settings.