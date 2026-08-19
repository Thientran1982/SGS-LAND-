---
name: SeoHead test cleanup
description: Helmet tests must unmount SeoHead before manually removing head nodes.
---

Tests that render `SeoHead` through `HelmetProvider` must unmount the component before deleting Helmet-managed `title` and meta nodes. Removing those nodes while React still owns the tree causes React DOM `removeChild` errors during cleanup.

**Why:** Helmet performs its own head reconciliation during unmount; external cleanup first leaves React holding detached nodes.

**How to apply:** Keep explicit `unmount()` in tests that render SeoHead, then perform document-head cleanup.