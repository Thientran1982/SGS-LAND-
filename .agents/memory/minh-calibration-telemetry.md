---
name: Minh calibration telemetry
description: Durable rule for confidence calibration and weekly Minh KPI evidence
---

Confidence calibration must count only delegations with an explicit outcome. A delegation that has no result signal is unresolved, not correct or incorrect. Record the specialist/tool outcome before the final answer synthesis so a later writer timeout does not erase valid latency, groundedness, or tool-use evidence.

**Why:** A final response provider can fail after the specialist already returned useful evidence; treating that whole interaction as missing would bias calibration and KPI toward infrastructure failures.

**How to apply:** Keep calibration curves and KPI snapshots honest with resolved/sample counts, and expose zero or null-derived metrics when evidence is absent rather than inventing success.