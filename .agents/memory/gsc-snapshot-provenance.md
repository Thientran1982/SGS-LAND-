---
name: GSC snapshot provenance
description: Search Console measurement must remain reproducible and separate from live API or inferred page mapping.
---

Store each GSC measurement snapshot with property, search type, date range, export date, source hash and whether the page mapping came from the export or an inferred recommendation. Compare exact query-plus-page keys; missing rows are not zero.

**Why:** GSC exports can omit page evidence, have different dimension totals and arrive as multiple report types. Treating an inferred destination or a missing after-row as observed performance creates false before/after conclusions.

**How to apply:** Use the snapshot and compare scripts for future exports, keep Web and Search Generative AI reports separate, and label CTR/ranking/citation outcomes unavailable until a post-change export exists.