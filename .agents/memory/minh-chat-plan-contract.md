---
name: Minh chat plan contract
description: Rules for exposing and persisting user-visible progress in Minh's To-dos panel
---

To-dos must consume a backend-authored structured plan, never scrape numbered prose. Persist step status under the authenticated tenant, user, and conversation; keep IDs stable and statuses explicit.

**Why:** Numbered explanatory text is not necessarily work to track, while an unscoped or browser-only update can mix or lose progress.

**How to apply:** Only expose plans backed by a verified workflow or explicit structured planner result, and require authenticated owner/session checks for reads and mutations.