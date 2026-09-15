---
name: Public Socket.IO proxy path
description: The slash behavior required for Engine.IO handshakes through the public Next.js proxy
---

The public Next.js rewrite accepts the slashless `/socket.io` path and forwards it to Express. Engine.IO clients must set `path: "/socket.io"` and `addTrailingSlash: false`; the default trailing slash is normalized by Next into a 308 redirect, while Express does not accept the slashless backend path directly.

**Why:** A browser smoke using the default Engine.IO path failed before it could observe durable live-chat events, even though direct backend polling worked.

**How to apply:** Keep the slashless path and `addTrailingSlash: false` together in the chat widget and any public-proxy Socket.IO probes. Validate the handshake through the public port, not only against the internal Express port.