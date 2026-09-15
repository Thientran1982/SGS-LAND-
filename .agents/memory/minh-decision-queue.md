---
name: Minh decision queue
description: Week 3 approval and budget boundary for proactive opportunity suggestions.
---

Proactive suggestions use explicit approval action types linked to one source signal. Listing and tenant subjects must not be forced into a lead foreign key; approved Week 3 actions currently create internal review/draft questions and never call a provider or mutate business data.

**Why:** The existing approval table was lead-centric while two Week 2 detectors target listings and the tenant. Reusing it without a nullable subject boundary would either violate ownership semantics or invent a fake lead.

**How to apply:** Keep `source_signal_id` unique per tenant, serialize the separate proactive daily budget, route approve/reject through the existing approval API, and fail closed before any future outreach executor.