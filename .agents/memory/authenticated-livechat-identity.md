---
name: Authenticated live-chat identity
description: Identity, storage, and deduplication rules for logged-in public live chat
---

Authenticated visitors must start or restore chat from their verified account identity, not from browser-supplied name or phone fields. Their local session key must be scoped by user ID, while the server keeps a durable user-to-lead association so clearing storage or changing devices does not create duplicate CRM leads.

**Why:** Public live chat is also available to guests, so a global browser key can mix a guest lead with a later logged-in account and cannot provide reliable CRM ownership.

**How to apply:** Resolve the account from the authenticated cookie, allow the authenticated flow to proceed without a phone form, deduplicate server-side by the internal user identifier, and keep the guest form unchanged.