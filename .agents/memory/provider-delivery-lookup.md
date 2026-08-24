---
name: Provider delivery lookup
description: How report delivery verification distinguishes safe retries from uncertain provider outcomes
---

Brevo can be queried by a stable delivery-key tag attached to transactional messages. An empty successful event query permits retry; delivered events, API errors, and providers without a lookup API remain blocked for manual review.

**Why:** A provider timeout must not become a duplicate email, while a definitive provider rejection should remain recoverable.

**How to apply:** Keep the tenant/date/recipient delivery key stable, update the claim only after a definitive lookup, and treat unsupported provider capabilities as unknown rather than as “not received.”