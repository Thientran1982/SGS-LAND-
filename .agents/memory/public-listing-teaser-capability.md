---
name: Public listing teaser capability
description: Security contract for resolving a listing in the public valuation teaser
---

Public teaser listing resolution must use a signed, purpose-bound capability containing the tenant and listing identifiers, then re-check those identifiers and an explicit public flag in the database on every request.

**Why:** A raw listing ID is not an authorization boundary; private rows and same-ID cross-tenant lookups must fail without exposing address, area, price, or comparable data.

**How to apply:** Keep token failures, private rows, and tenant mismatches indistinguishable; resolve only minimal valuation inputs, and invalidate access immediately when the listing is no longer public.