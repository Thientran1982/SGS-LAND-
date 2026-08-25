---
name: Migration history aliases
description: How to handle renamed migration filenames already recorded in the runtime database
---

When migration filenames are corrected after being applied, preserve the historical schema_versions rows and canonicalize known legacy names during status and pending checks instead of deleting rows or replaying migrations.

**Why:** Long-lived runtime databases can contain valid historical names that no longer match the static source registry; treating them as unexpected creates false drift, while replaying them risks duplicate schema changes.

**How to apply:** Add an explicit, reviewed alias map for each rename and keep the migration registry itself limited to the current canonical filenames.