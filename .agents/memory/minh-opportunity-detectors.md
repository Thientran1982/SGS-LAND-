---
name: Minh opportunity detector guardrails
description: Durable safety and performance rules for Minh's read-only proactive opportunity scans.
---

Proactive opportunity detectors must fail closed on missing evidence, remain tenant-scoped, and emit only a versioned READ signal plus safe audit metadata. They must never create a business action, approval, provider call, or raw customer-feedback payload.

**Why:** The first runtime shadow tick showed that an unindexed listing-to-reference comparison can hold the Node event loop while scanning several tenants, even when the detector is read-only.

**How to apply:** Keep exact normalized location keys indexed, bound shadow candidate batches, use provenance/confidence/observed timestamps, and keep detector failures isolated and visible as degraded rather than treating missing references as zero.