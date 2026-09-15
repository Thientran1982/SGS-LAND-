---
name: Minh Week 1 overlay
description: The safe rollout boundary for specialist manifests and the central scheduler observer.
---

Week 1 uses a shadow Brain Scheduler overlay rather than replacing the five
legacy timers. It may count tenants and report scheduler ownership, but it must
not invoke business jobs, send messages, create approvals, or promote learning
candidates.

**Why:** The existing timers already own delivery and learning behavior. A
central replacement before parity evidence would create duplicate jobs or
silently skip work during a refactor.

**How to apply:** Keep `observedOnly` and a per-tick trace ID in the overview,
keep compound routing explicitly gated, and require manifest validation plus
shadow parity before enabling detectors or Suggest mode.