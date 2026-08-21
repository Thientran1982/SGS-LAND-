---
name: Campaign delivery safety
description: Durable rules for campaign recipient deduplication, terminal states, retries, and scheduler failure handling.
---

Campaign delivery must treat `(campaign, normalized email)` as one recipient identity. `SENT`, `OPENED`, `CLICKED`, and `UNSUBSCRIBED` are terminal for that campaign; only `FAILED` recipients may be reset and retried. Delivery or scheduler failures must not mark a campaign completed.

**Why:** A campaign can be invoked by more than one operational path (activation, manual run, and scheduler), and tracking endpoints can be called repeatedly. Application-only deduplication is not sufficient without a database uniqueness guarantee and explicit terminal-state handling.

**How to apply:** Preserve the unique campaign/email index when changing recipient insertion, keep tracking counters conditional on first occurrence, and use `PAUSED` plus retryable failed recipients when a send run has errors. Scheduled activation must carry its stored future timestamp; immediate runs must pause on provider/configuration errors instead of becoming completed.

Marketing email consent is an explicit opt-in, defaulting to false. Audience previews, campaign sends, and sequence enrollment/execution must all exclude missing consent and email opt-outs; unsubscribe must persist suppression beyond the current campaign.

**Why:** A recipient who was once present in a campaign must not automatically become eligible for future marketing, and preview counts must never promise delivery to contacts the sender will later suppress.

**How to apply:** Keep consent and opt-out predicates identical in preview and delivery queries, audit consent changes, and require a deliberate consent capture flow before enabling a lead or user.