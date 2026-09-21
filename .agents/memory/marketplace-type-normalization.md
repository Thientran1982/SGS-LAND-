---
name: Marketplace type normalization
description: Public marketplace listings can carry property types in enum, Vietnamese label/slug, or JSON attributes.
---

The public marketplace must normalize property types at the API boundary and in client-side grouping. Matching only the canonical `type` string causes localized/imported listings to disappear from filters or fall into “Other”; BOARD views must not group only the SSR page.

**Why:** Imported listing sources use inconsistent fields and labels, while the public page is intentionally paginated for normal grid/list views.

**How to apply:** Keep semantic aliases for filters, accept `attributes.propertyType`/`property_type`/`type` as legacy sources, normalize before grouping, and fetch all matching pages only when the user opens BOARD.