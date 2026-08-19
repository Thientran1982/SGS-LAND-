---
name: Approval action policies
description: Safety contracts for AI high-impact actions and payment/document boundaries.
---

High-impact actions require explicit structured payloads and idempotency keys. Document delivery uses email with a stable delivery key; deposit confirmation is verification-only against an already verified payment and must never mark a booking paid from an approval.

**Why:** Booking, proposal, email, and payment systems have different retry and side-effect guarantees; treating them as one generic action can duplicate money or messages.

**How to apply:** Add a dedicated payload validator and executor for each new action. Keep provider/payment confirmation as the source of truth and fail closed when required fields or verification evidence are absent.