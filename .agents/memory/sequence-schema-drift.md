---
name: Sequence enrollment schema drift
description: Sequence enrollment migrations may be recorded while their unique constraint is absent in the runtime database.
---

The sequence backfill must defensively repair the `(sequence_id, lead_email)` uniqueness guarantee before using `ON CONFLICT`; migration history alone is not proof that the live constraint exists.

**Why:** A runtime database had the earlier migration recorded but lacked the constraint, causing a later backfill to roll back.

**How to apply:** Any future enrollment/backfill migration should verify or recreate required constraints and safely deduplicate existing rows before relying on them.