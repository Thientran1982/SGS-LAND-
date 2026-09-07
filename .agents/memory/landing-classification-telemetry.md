---
name: Landing classification telemetry
description: Landing classifier monitoring uses privacy-safe categorical signals and heuristic candidate labels
---

Landing telemetry must store only language, classifier flags, final intent, draft status, and bounded counts/hashes; never persist the visitor brief, project name, price, generated content, or slug in audit telemetry.

**Why:** Real landing briefs combine project and price details, so raw audit records can expose sensitive commercial information while still failing to show classifier regressions.

**How to apply:** Treat candidate/false-negative counts as a review signal rather than ground truth; use the language aggregate report to prioritize examples for a separately consented labeling flow.

Explicit landing creation requests should tolerate common misspellings of
“landing” before project/price intent matching runs.

**Why:** A real visitor request used “ladning”; without typo tolerance it was
classified as a project question and never reached the landing builder.

**How to apply:** Keep typo-tolerant target matching shared by the classifier
and its telemetry so detected, candidate, and false-negative signals do not
disagree.