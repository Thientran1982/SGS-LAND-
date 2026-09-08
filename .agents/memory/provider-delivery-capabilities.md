---
name: Provider delivery capabilities
description: External messaging providers do not share a portable idempotency or delivery-status API.
---

The outbound system must derive one stable delivery key from the durable outbox. Email can carry that key through Message-ID/custom headers and application dedupe; Zalo and Facebook currently cannot prove provider-side dedupe or acceptance, so UNKNOWN must remain manual-takeover rather than being blindly resent. Zalo product sharing uses the v3 customer-service endpoint with separate media-template messages for public HTTPS images; the delivery key is application metadata, not provider idempotency.

**Why:** A timeout after provider acceptance is indistinguishable from a timeout before acceptance without a provider lookup, so automatic retry would trade message loss for duplicate messages.

**How to apply:** Add provider-native idempotency/status lookup only when the provider documents and supports it; otherwise preserve the outbox fencing and UNKNOWN/manual reconciliation path. For Zalo, send the full text in ≤2,000-character chunks first, then image media messages, and stop on the first definitive or ambiguous failure.