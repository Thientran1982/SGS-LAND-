---
name: Landing Design Agent boundary
description: Boundary between Minh, the landing builder, and the landing design specialist.
---

The Landing Design Agent is intentionally deterministic and returns a bounded structured design draft. It may choose a visual pattern, semantic tokens, hierarchy, gallery layout, CTA placement, and accessibility checks from verified inputs, but it must not invent project facts, send customer messages, change quota, or publish.

**Why:** A second provider call would add latency and another failure mode to the landing flow, while deterministic output keeps price/legal grounding and draft/public boundaries intact.

**How to apply:** Keep the design agent as a pure specialist/helper. If an LLM-backed variant is introduced later, preserve the same output contract and validate it before passing anything to `landing_builder`.