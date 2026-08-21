---
name: Project detail localization
description: Project detail EN content is maintained as a separate reviewed dataset rather than translated at render time.
---

The six public project detail pages use separate English datasets for long-form content, including FAQs, entity tables, amenities, pricing details and location copy. Vietnamese remains the source dataset.

**Why:** Real-estate figures, legal caveats, provenance wording and proper nouns must not be altered by runtime or automatic translation.

**How to apply:** When adding or changing a featured project detail, update both the Vietnamese source data and the corresponding English localization dataset, then verify both `/du-an/...` and `/en/du-an/...`.