---
name: Autonomous learning guardrails
description: Feedback and calibration must remain quarantined and gated before becoming production learning signals.
---

Feedback and calibration are treated as untrusted input: provenance, quality, poisoning, consent, regression, and promotion gates must be persisted before a signal can affect prompts, rollouts, or valuation.

**Why:** Autonomous model changes can amplify prompt injection, duplicate feedback, bad market observations, or runtime regressions unless every transition is fail-closed and auditable.

**How to apply:** Keep shadow → canary → active promotion, last-known-good rollback, append-only audit events, and tenant-scoped lifecycle claims in place for future learning work.