---
name: Public locale verification
description: The practical contract for localized public routes behind the Next middleware rewrite.
---

Public `/en` routes are rewritten to their canonical route before client navigation runs, so a client component cannot safely derive its outgoing href from `usePathname()` alone. It must use the locale context and explicitly preserve the `/en` prefix for internal links, filters, pagination, map popups and related content.

**Why:** A page can render English copy and still silently send visitors back to Vietnamese routes after one client-side navigation if the rewritten pathname is treated as the original URL.

**How to apply:** Browser smoke tests should visit both VI and EN URLs, assert `html[lang]`, assert representative localized copy, and inspect representative project/area/expert links for the `/en` prefix. Restart the Next dev workflow after a production build before using the preview; otherwise stale Turbopack manifests can produce a false runtime error.

For mobile horizontal rails, compare document width with viewport width on both locale routes, and separately verify the rail can still scroll.

**Why:** A horizontally scrollable listing rail can widen the document even when the page root clips overflow. Layout containment on the rail keeps that scroll local without disabling swipe.

**How to apply:** When changing homepage cards, copy, or responsive styles, check `/` and `/en` at mobile, tablet, and desktop widths; assert the document does not overflow and the listing row advances independently.