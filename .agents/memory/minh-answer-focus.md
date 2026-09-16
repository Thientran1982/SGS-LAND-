---
name: Minh answer focus
description: Durable guardrails for keeping Agent Minh accurate and concise across follow-up conversations
---

The current user message is authoritative. Recent history may resolve a pronoun or a direct follow-up, but an inferred topic summary or long-term memory must not introduce facts into a new answer. Specialist output is internal evidence; only the Writer may turn it into customer-facing prose. Missing or conflicting evidence requires an explicit uncertainty statement or clarification, never a guessed claim.

**Why:** Topic digests and persistent memory can make old project, price, or legal details look current, while specialist dumps and repeated paragraphs make answers appear inaccurate and unfocused.

**How to apply:** Keep context bounded and clearly labeled, gate memory by relevance, enforce the output contract after generation, and cover follow-up/empty-evidence/markup cases with deterministic tests.

Named-project price questions that omit the property type are clarification cases, not valuation defaults. Route them through the fast deterministic path before personalization, specialist retrieval, or provider synthesis; bedroom-count wording can identify an apartment.

**Why:** A short question such as “Giá Masteri” previously fell through to GENERAL, invoked the legacy provider chain, and eventually answered with an implicit APARTMENT assumption after more than two minutes.

**How to apply:** Preserve the explicit product type when present (apartment, townhouse, villa, or bedroom count); otherwise ask which type the customer means and do not invent a price.