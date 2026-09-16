---
name: Outreach delivery audit history
description: Durable rules for recording provider lookups and broker decisions behind manual outreach reconciliation.
---

Provider lookup results and broker reconciliation decisions must be stored as separate append-only events under the delivery's tenant. Persist only allowlisted evidence such as lookup status, provider event/message ID, decision note, and operator identity; never persist raw provider payloads.

**Why:** Delivery status alone cannot resolve later disputes, while provider responses may contain sensitive recipient or transport data that does not belong in an audit timeline.

**How to apply:** Keep the status mutation and its decision event atomic, enforce tenant context and append-only database controls, and return the complete ordered event history to broker review surfaces.