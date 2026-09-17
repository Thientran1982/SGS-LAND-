---
name: Valuation location matching
description: Rules for selecting historical market-price rows without cross-province contamination
---

Historical valuation rows must match through the shared location hierarchy: canonical project first, then district, then province, with exact normalized-key/meaningful containment only as a last resort. Matching on individual first/last tokens is unsafe because common words and province suffixes can make unrelated regions look similar. When no meaningful match exists, use the deterministic regional baseline and keep the result marked as a reference estimate.

**Why:** A token-based query caused Quận 1 to select Long An/Nghệ An data and caused an Aqua City address to select an unrelated Đồng Nai row, producing materially wrong teaser prices.

**How to apply:** Preserve the full `location_key` in candidate queries, use the strongest hierarchy anchor only as a SQL pre-filter, re-check the full display/key in application code, and reject malformed historical ranges rather than displaying them as precise market bounds.