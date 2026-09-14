---
name: Google Search Console property API
description: The SGS LAND Search Console access is granted on a domain property and uses the v3 API endpoint.
---

Use `sc-domain:sgsland.vn` as the Search Console property identifier and the `webmasters/v3` API path. The URL-prefix form `https://sgsland.vn/` is not interchangeable for this service account.

**Why:** A live restricted service-account check returned HTTP 200 for the domain property, while the URL-prefix property returned 403 and the v4 path returned 404.

**How to apply:** Keep `GSC_SITE_URL` aligned with the property type granted in Search Console, and use v3 for Search Console webmasters requests.