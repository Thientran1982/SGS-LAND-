---
name: GEO provenance contract
description: Answer-first project pages must keep review date, evidence boundary and schema facts aligned.
---

Project and landing pages should expose a visible direct answer, named editorial ownership, a fixed review date and an explicit evidence boundary. Numeric JSON-LD facts such as offers, area and amenities require an attached dated source; static seed values alone are not evidence.

**Why:** Answer engines can extract schema and noscript content without the surrounding UI. Unsourced structured facts become authoritative-looking claims even when the visible page says they are only indicative.

**How to apply:** Reuse the shared provenance contract for new project/area templates, audit rendered HTML rather than only source files, and preserve `unavailable` as a real state when Search Console or external source measurements are not connected.