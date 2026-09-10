---
name: Social publishing provider safety
description: Public social publishers must verify tenant-scoped permissions and treat uncertain provider POSTs as manual reconciliation.
---

Public publishing capability is tenant-scoped and must be live-verified against the provider connection before activation or worker delivery. A successful HTTP response without a provider post ID is not success; network/5xx outcomes are ambiguous and must not be retried automatically when the provider lacks a reliable idempotency/status lookup.

**Why:** Existing Facebook and Zalo adapters support direct messages, but that permission does not prove public Page/feed publishing. Retrying an uncertain social POST can create duplicate public listings.

**How to apply:** Keep messaging and public-publishing registries separate, verify the connected Page/token at connection and delivery time, require provider confirmation IDs for `PUBLISHED`, and expose `NOT_READY`/`AMBIGUOUS` with safe operator-facing reasons.

The composition UI may resolve relative or local image paths through the current preview origin for operator viewing, but it must not rewrite the immutable provider asset snapshot. Provider-bound assets still require explicit public HTTPS normalization.

**Why:** Browser preview and provider delivery have different URL requirements; making a local preview URL publishable would either break local development or leak an inaccessible host to a provider.

**How to apply:** Keep display URL normalization in the UI image component/dropdown layer and retain the server-side HTTPS/public-origin gate before draft activation or delivery.

Legacy listing imports may still contain public `http://` image URLs, which browsers block as mixed content inside the HTTPS CRM preview; the display layer may upgrade those URLs to HTTPS without weakening the provider-side asset gate.

**Why:** A valid remote image can appear broken only because the operator is viewing the CRM over HTTPS, not because the file is missing.

**How to apply:** Treat this as a display compatibility repair only; do not persist the rewritten display URL as a provider asset unless the server can verify its tenant ownership and public HTTPS reachability.

For Zalo OA broadcast, the provider contract is `POST /v2.0/oa/message` with an article attachment. A tenant must first pass the read-only OA identity check and the documented quota/permission probe (`POST /v3.0/oa/quota/message`) before the capability can become READY.

**Why:** Zalo's broadcast endpoint has no dry-run, while the quota endpoint verifies the send-and-notify permission without broadcasting to followers.

**How to apply:** Require a tenant-scoped probe user and matching OA ID, create/verify the article before broadcasting, treat missing `message_id` or uncertain network outcomes as AMBIGUOUS, and never claim success without the provider ID.

Operator reconciliation must be a separate, audited state transition: only an explicit provider post ID may turn `AMBIGUOUS` into `PUBLISHED`, while retrying a failed target requires a recorded reason and never requeues `AMBIGUOUS` directly.

**Why:** Treating manual confirmation and retry as the same action can either falsely report a post or duplicate an uncertain provider request.

**How to apply:** Keep reconciliation tenant-scoped and transactional, show provider request/attempt history to operators, and require an operator to mark an ambiguous result failed before any later retry.

Structured reconcile conflicts must preserve the machine-readable code on both the thrown client error and its attached response payload, while the UI should surface that code for operator conflicts.

**Why:** A localized message is useful to people but insufficient for deterministic UI behavior, telemetry, and regression tests across the HTTP boundary.

**How to apply:** Keep `TARGET_STATE_CONFLICT` stable from the route JSON through `apiClient` and the reconciliation error state; test the backend and frontend boundaries separately.