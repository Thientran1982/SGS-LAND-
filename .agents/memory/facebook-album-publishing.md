---
name: Facebook album publishing
description: Facebook Page albums require staged unpublished photo uploads followed by one feed post.
---

Facebook multi-photo publishing is a multi-request provider operation: upload each approved public image as an unpublished Page photo, then create the feed post with the returned media IDs. If any request after the operation starts is uncertain, keep the publication AMBIGUOUS and preserve all provider trace IDs; never retry automatically.

**Why:** Facebook does not provide a portable idempotency or status lookup contract for this flow, and retrying after partial acceptance can create duplicate or orphaned public content.

**How to apply:** Keep album size aligned with the capability/catalog and immutable asset snapshot. Treat the final feed response as unconfirmed unless it includes a provider post ID, and record partial progress in the existing publication attempt audit. Relative upload paths may be expanded only with an explicit HTTPS public origin; never use a preview-domain fallback for Facebook assets.

When creating the final Page feed post, do not send a `link` field together with `attached_media`; keep the public URL in the caption instead.

**Why:** Facebook can prioritize the link preview and silently omit the staged album photos when both payload fields are present.

**How to apply:** For album posts, send the caption/message plus `attached_media` only, and log provider status, error details, and trace IDs for every rejected photo or feed request.