---
name: Social publishing provider safety
description: Public social publishers must verify tenant-scoped permissions and treat uncertain provider POSTs as manual reconciliation.
---

Public publishing capability is tenant-scoped and must be live-verified against the provider connection before activation or worker delivery. A successful HTTP response without a provider post ID is not success; network/5xx outcomes are ambiguous and must not be retried automatically when the provider lacks a reliable idempotency/status lookup.

**Why:** Existing Facebook and Zalo adapters support direct messages, but that permission does not prove public Page/feed publishing. Retrying an uncertain social POST can create duplicate public listings.

**How to apply:** Keep messaging and public-publishing registries separate, verify the connected Page/token at connection and delivery time, require provider confirmation IDs for `PUBLISHED`, and expose `NOT_READY`/`AMBIGUOUS` with safe operator-facing reasons.

Operator reconciliation must be a separate, audited state transition: only an explicit provider post ID may turn `AMBIGUOUS` into `PUBLISHED`, while retrying a failed target requires a recorded reason and never requeues `AMBIGUOUS` directly.

**Why:** Treating manual confirmation and retry as the same action can either falsely report a post or duplicate an uncertain provider request.

**How to apply:** Keep reconciliation tenant-scoped and transactional, show provider request/attempt history to operators, and require an operator to mark an ambiguous result failed before any later retry.

Structured reconcile conflicts must preserve the machine-readable code on both the thrown client error and its attached response payload, while the UI should surface that code for operator conflicts.

**Why:** A localized message is useful to people but insufficient for deterministic UI behavior, telemetry, and regression tests across the HTTP boundary.

**How to apply:** Keep `TARGET_STATE_CONFLICT` stable from the route JSON through `apiClient` and the reconciliation error state; test the backend and frontend boundaries separately.