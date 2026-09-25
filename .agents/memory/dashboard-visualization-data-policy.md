---
name: Dashboard visualization data policy
description: Constraints for charting existing dashboard metrics without changing their meaning.
---

Use existing tenant-scoped analytics and explicit targets only. Keep headline values visible and preserve measured zero separately from unavailable data. Do not invent goals, SLAs, intermediate dates, or missing series points to make a visualization look complete. For sales velocity, fewer days to close is better: compare actual days with an explicit maximum-days target instead of treating a longer duration as greater progress.

**Why:** Dashboard visuals must remain operationally trustworthy and preserve each metric's meaning.

**How to apply:** Before changing a dashboard chart, identify its source, units, and favorable direction. Use an explicit empty or unavailable state when required inputs are absent.