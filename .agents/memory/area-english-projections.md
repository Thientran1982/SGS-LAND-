---
name: Area English projections
description: Localization boundary for area-level real-estate pages that reuse Vietnamese source datasets
---

Area-level pages may reuse the Vietnamese source dataset for reviewed proper nouns and factual values, but their English UI navigation and structured-data projection must be localized separately.

**Why:** Area pages are not individual projects, and their source records contain Vietnamese labels, generic owner descriptions and indicative price wording that should not leak into English visible content or JSON-LD.

**How to apply:** When adding an area slug, update its English display name, nav-label mapping, and schema name/description/developer/price projection; keep locations and proper nouns unchanged where appropriate.