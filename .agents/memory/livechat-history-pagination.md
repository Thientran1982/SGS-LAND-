---
name: Live-chat history pagination
description: Durable rule for public chat history cursors and widget restoration
---

Public live-chat history must use a keyset cursor based on `(timestamp, id)` and return pages in chronological display order. Keep the no-cursor response compatible for existing clients, and prepend older pages with deduplication while preserving scroll position.

**Why:** Offset pagination shifts when new interactions arrive during a session, which can duplicate or skip messages in an operator or customer review.

**How to apply:** Treat the cursor as opaque, validate it before querying, and keep history pagination separate from the full history query used to build AI context.