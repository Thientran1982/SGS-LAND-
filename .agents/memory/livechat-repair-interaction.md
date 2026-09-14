---
name: Live-chat repair interaction identity
description: Legacy live-chat repair must reuse the original outbound interaction identity.
---

Repair executions may have a new durable run ID, but they must update the
existing outbound interaction created by the legacy run when that interaction
can be identified. The widget should merge a repeated interaction ID instead
of appending a second assistant bubble.

**Why:** A repair run is a retry of the same customer message; persisting a
new outbound row makes history and the public widget show two answers.

**How to apply:** Keep the original interaction ID as the user-visible
identity, update its content and correlation metadata, and only create a new
row when no legacy interaction can be found.