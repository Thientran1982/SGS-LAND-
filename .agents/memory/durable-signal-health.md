---
name: Durable signal health
description: Signal write failures must survive process restarts without retaining raw error payloads.
---

Durable signal health should aggregate failures by tenant and signal type, retain only bounded sanitized error context, and enforce tenant isolation at the database layer.

**Why:** In-process failure counters disappear during restarts, while raw integration errors can accidentally retain personal or request-sensitive data.

**How to apply:** Keep the health query window bounded and ensure schema upgrades are idempotent for environments where the original health migration already ran.