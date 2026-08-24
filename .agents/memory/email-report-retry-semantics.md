---
name: Email report retry semantics
description: Durable delivery behavior for scheduled report emails when providers fail or time out
---

Definitive provider failures may be retried using the same delivery key. Outcomes where the provider may have accepted the message must remain ambiguous and block resend, because retrying could create a duplicate.

**Why:** A process retry must recover from a known rejection without turning a provider timeout into two successful deliveries.

**How to apply:** Preserve the stable tenant/date/recipient delivery key across attempts, classify ambiguous results explicitly, and keep the captured report snapshot when re-running a failed report.