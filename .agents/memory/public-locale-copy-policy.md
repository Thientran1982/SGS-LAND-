---
name: Public locale copy policy
description: Rules for keeping English public routes honest when source content has not been reviewed in English.
---

English public routes must not silently render Vietnamese editorial or factual copy. Use reviewed localized content where it exists; otherwise show a clear English availability notice and keep the source-language link explicit. Metadata, schema, CTAs, filters, and internal links must use the same locale as the page.

**Why:** Mixed-language pages make the locale promise unreliable and can expose unsourced project claims as if they were reviewed English content.

**How to apply:** When adding a public `/en` route, audit rendered text and metadata together. Prefer a clear untranslated-content state over machine-translated or partially localized editorial content.