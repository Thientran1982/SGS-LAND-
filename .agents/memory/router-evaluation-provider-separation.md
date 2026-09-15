---
name: Router evaluation provider separation
description: Router gold-set runs must distinguish provider outages from model and extraction failures.
---

Router quality gates should report provider failures separately, exclude them from model accuracy, and still fail the run until a clean rerun is available. Router-only gates must include extraction/content assertions, not only intent labels.

**Why:** Quota or credential failures can otherwise look like widespread routing regressions, while intent-only thresholds can hide missing entities that downstream specialists need.

**How to apply:** Inspect provider-failure count and full-pass accuracy together; require zero provider failures for a publishable baseline and keep compound specialist fan-out disabled until the complete contract gate is green.