---
name: Customer profile boundaries
description: Separation and consent rules for Minh customer personalization data
---

Customer personalization must live in a dedicated profile model, separate from enterprise Company Brain and generic agent memory. Profile writes are fail-closed until explicit profile consent is OPTED_IN; customer-facing reads must exclude sensitive facts by default.

**Why:** Company knowledge and personal preferences have different ownership, retention, and erasure rights; treating them as one namespace risks privacy leakage and invalid personalization.

**How to apply:** Resolve profile identity from the authenticated customer identity, enforce tenant scope in every query, preserve superseded facts for audit, and expose opt-out/erasure as idempotent customer actions.

Historical superseded facts may have an end date before their observation date because supersession closes them at the replacement boundary; the database validity check must explicitly allow that state.

**Why:** The service preserves superseded rows for audit while marking them inactive, and a strict `valid_until >= valid_from` check otherwise makes the required history impossible to store.

**How to apply:** Keep superseded rows queryable for audit but excluded from active context, and only allow the earlier end date when `superseded_by` is populated.