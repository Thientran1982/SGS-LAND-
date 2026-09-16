---
name: Outreach approval boundary
description: Week 8 outreach drafts stay in the approval queue and never send through a provider automatically.
---

Outreach Bot may build at most two grounded channel variants, but approval only marks the draft ready for a broker's manual send. The approval executor must revalidate current lead consent and channel opt-outs and report `providerCalled: false`.

**Why:** Consent can be revoked after draft creation, and Zalo/email delivery outcomes are not safe to infer from a generic approval action.

**How to apply:** Use the dedicated outreach draft approval action for future outreach work; do not reuse provider-send actions or add provider calls to the approval executor.