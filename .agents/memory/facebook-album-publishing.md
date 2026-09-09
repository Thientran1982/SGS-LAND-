---
name: Facebook album publishing
description: Facebook Page albums require staged unpublished photo uploads followed by one feed post.
---

Facebook multi-photo publishing is a multi-request provider operation: upload each approved public image as an unpublished Page photo, then create the feed post with the returned media IDs. If any request after the operation starts is uncertain, keep the publication AMBIGUOUS and preserve all provider trace IDs; never retry automatically.

**Why:** Facebook does not provide a portable idempotency or status lookup contract for this flow, and retrying after partial acceptance can create duplicate or orphaned public content.

**How to apply:** Keep album size aligned with the capability/catalog and immutable asset snapshot. Treat the final feed response as unconfirmed unless it includes a provider post ID, and record partial progress in the existing publication attempt audit.