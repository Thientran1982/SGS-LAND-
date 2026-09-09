---
name: Zalo readiness transition alerts
description: Tenant-scoped Zalo broadcast readiness alerts must serialize state changes and expose only reviewed verification facts.
---

A readiness alert should be emitted only for a persisted READY → NOT_READY transition. Serialize the read-and-write transition per tenant so concurrent verification requests cannot create duplicate alerts, and build the admin notification from the allowlisted reason code and verification timestamp rather than provider output.

**Why:** Zalo provider responses can contain credentials, probe context, or unstable messages, and concurrent admin checks otherwise race on the previous audit state.

**How to apply:** Keep transition detection in the tenant-scoped audit transaction, use the existing admin notification repository for in-app delivery, and treat notification delivery failure as separate from the verification result.