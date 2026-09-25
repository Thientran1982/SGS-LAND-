---
name: Approval action policies
description: Safety contracts for AI high-impact actions and payment/document boundaries.
---

High-impact actions require explicit structured payloads and idempotency keys. Document delivery uses email with a stable delivery key; deposit confirmation is verification-only against an already verified payment and must never mark a booking paid from an approval. When an approval endpoint persists approval before returning the executor result, a failed response is ambiguous: show UNKNOWN, suppress blind retries, and direct the operator to verify the authoritative approval history.

**Why:** Booking, proposal, email, and payment systems have different retry and side-effect guarantees; approval may commit before execution returns, so an HTTP error does not prove that no action occurred.

**How to apply:** Add a dedicated payload validator and executor for each new action. Keep provider/payment confirmation as the source of truth, fail closed when verification evidence is absent, and never offer an immediate retry after an ambiguous approval response.