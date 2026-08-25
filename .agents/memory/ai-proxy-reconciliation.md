---
name: AI proxy reconciliation
description: Production behavior when long-running AI requests outlive a browser or proxy connection
---

When a provider fallback or rate-limit response makes an AI request long-running, the proxy or browser can report a connection error even though the server completes the run and persists the assistant message. Chat clients should reconcile the durable conversation once before showing a send failure.

**Why:** Production logs showed a persisted public live-chat response taking roughly 40 seconds alongside a proxy `socket hang up`; the next history reload displayed the response.

**How to apply:** Keep AI request timeouts longer than ordinary CRUD requests, and on ambiguous network/transport failures fetch the conversation history and match an assistant message after the current inbound message before offering retry.