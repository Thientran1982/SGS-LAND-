---
name: Minh learning trend privacy
description: Operator learning aggregates must stay tenant-scoped, bounded, and free of raw answer/provider payloads.
---

Minh operator trends expose only bounded counts and categorical labels. Every aggregate and recent sample must use the same tenant scope and date window; raw human answers and provider payloads are never part of the response.

**Why:** Operators need approval, execution, and answer trends without turning the learning ledger into a source of tenant data leakage or sensitive answer text.

**How to apply:** Clamp requested windows to a small allowlist/range, derive tenant identity from authenticated context, and represent missing data as empty or degraded rather than as fabricated zeroes.