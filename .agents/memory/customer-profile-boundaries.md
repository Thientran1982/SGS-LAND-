---
name: Customer profile boundaries
description: Separation and consent rules for Minh customer personalization data
---

Customer personalization must live in a dedicated profile model, separate from enterprise Company Brain and generic agent memory. Profile writes are fail-closed until explicit profile consent is OPTED_IN; customer-facing reads must exclude sensitive facts by default.

**Why:** Company knowledge and personal preferences have different ownership, retention, and erasure rights; treating them as one namespace risks privacy leakage and invalid personalization.

**How to apply:** Resolve profile identity from the authenticated customer identity, enforce tenant scope in every query, preserve superseded facts for audit, and expose opt-out/erasure as idempotent customer actions.