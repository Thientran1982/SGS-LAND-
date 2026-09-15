---
name: Admin Cockpit degraded mode
description: Reliability boundary for the operator dashboard when its database connection cannot be acquired
---

The Admin Cockpit must remain structurally usable during a transient database or pool failure, but it must mark the response as degraded and explain that metrics are unavailable. Missing metrics must never be presented as healthy zeroes.

**Why:** The cockpit is an operational control surface. A temporary connection timeout should not turn the entire dashboard into a fatal error, while silently returning empty arrays would mislead operators into believing there are no events, questions, or executions.

**How to apply:** Keep the fallback at the route boundary for failures that occur before repository-level optional-query handling can run. Return the reviewed default role cards plus empty operational collections, an explicit degraded marker, and a user-visible retry warning. Add a route test that exercises a connection-timeout failure.