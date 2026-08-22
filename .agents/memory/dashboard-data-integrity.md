---
name: Dashboard data integrity
description: Dashboard analytics must distinguish an API outage from legitimate zero-valued business metrics.
---

The overview must never convert a failed analytics request into a synthetic all-zero summary. A failed request should reach the dashboard error state so users can retry and do not mistake unavailable production data for zero activity.

**Why:** Accurate production reporting is a core product requirement; zero-valued fallbacks hide outages and can lead to incorrect business decisions.

**How to apply:** Preserve the analytics request error through the data layer, keep the dashboard's localized loading/error/retry states, and use fallback values only for missing optional fields inside a successful response.