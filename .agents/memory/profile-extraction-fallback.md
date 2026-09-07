---
name: Profile extraction fallback
description: Safety boundary for enriching consented customer profile facts with an optional LLM
---

Customer-profile LLM extraction is enrichment only. Run it alongside deterministic observation, validate every item through the existing category/source/confidence normalizer, then let the LLM replace the regex fact only within the same category. Any timeout, provider error, malformed JSON, or invalid item must preserve the deterministic facts.

**Why:** Profile capture must remain useful during provider outages without weakening consent, PII scrubbing, or schema guardrails.

**How to apply:** Keep the LLM path best-effort and category-scoped; never make customer personalization depend on a successful model call.