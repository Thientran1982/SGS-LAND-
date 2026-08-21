---
name: Recurring campaign schedules
description: Rules for daily, weekly, and monthly campaign recurrence.
---

Recurring campaigns use the next `scheduled_at` as their durable schedule marker. The scheduler must advance that timestamp in the same atomic claim that marks a run, before delivery begins, so concurrent scheduler drivers cannot claim the same occurrence.

**Why:** The application can have both an in-process scheduler and a QStash request driver. A recurrence implementation based only on `last_run_at` can either run twice or remain permanently due.

**How to apply:** Keep one-time campaigns transitioning to `COMPLETED`; successful recurring campaigns stay `ACTIVE`, while delivery failures transition to `PAUSED` for explicit recovery.