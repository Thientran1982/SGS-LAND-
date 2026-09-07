---
name: Landing classification telemetry
description: Landing classifier monitoring uses privacy-safe categorical signals and heuristic candidate labels
---

Landing telemetry must store only language, classifier flags, final intent, draft status, and bounded counts/hashes; never persist the visitor brief, project name, price, generated content, or slug in audit telemetry.

**Why:** Real landing briefs combine project and price details, so raw audit records can expose sensitive commercial information while still failing to show classifier regressions.

**How to apply:** Treat candidate/false-negative counts as a review signal rather than ground truth; use the language aggregate report to prioritize examples for a separately consented labeling flow.