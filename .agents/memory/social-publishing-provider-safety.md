---
name: Social publishing provider safety
description: Public social publishers must verify tenant-scoped permissions and treat uncertain provider POSTs as manual reconciliation.
---

Public publishing capability is tenant-scoped and must be live-verified against the provider connection before activation or worker delivery. A successful HTTP response without a provider post ID is not success; network/5xx outcomes are ambiguous and must not be retried automatically when the provider lacks a reliable idempotency/status lookup.

**Why:** Existing Facebook and Zalo adapters support direct messages, but that permission does not prove public Page/feed publishing. Retrying an uncertain social POST can create duplicate public listings.

**How to apply:** Keep messaging and public-publishing registries separate, verify the connected Page/token at connection and delivery time, require provider confirmation IDs for `PUBLISHED`, and expose `NOT_READY`/`AMBIGUOUS` with safe operator-facing reasons.