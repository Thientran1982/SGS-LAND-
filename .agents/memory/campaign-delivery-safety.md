---
name: Campaign delivery safety
description: Durable rules for campaign recipient deduplication, terminal states, retries, and scheduler failure handling.
---

Campaign delivery must treat `(campaign, normalized email)` as one recipient identity. `SENT`, `OPENED`, `CLICKED`, and `UNSUBSCRIBED` are terminal for that campaign; only `FAILED` recipients may be reset and retried. Delivery or scheduler failures must not mark a campaign completed.

**Why:** A campaign can be invoked by more than one operational path (activation, manual run, and scheduler), and tracking endpoints can be called repeatedly. Application-only deduplication is not sufficient without a database uniqueness guarantee and explicit terminal-state handling.

**How to apply:** Preserve the unique campaign/email index when changing recipient insertion, keep tracking counters conditional on first occurrence, and use `PAUSED` plus retryable failed recipients when a send run has errors. Scheduled activation must carry its stored future timestamp; immediate runs must pause on provider/configuration errors instead of becoming completed.