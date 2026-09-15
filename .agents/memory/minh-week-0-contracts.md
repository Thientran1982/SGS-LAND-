---
name: Minh Week 0 contracts
description: The lifecycle, error, and trace vocabulary that must stay stable before Minh orchestration expands.
---

Minh runs should expose one lifecycle vocabulary, machine-readable error codes,
and a trace chain from request through inbound interaction, durable run,
specialist checkpoints, provider attempts, and outbound persistence. Provider
adapters may have internal states, but must map them into the shared contract.

**Why:** Orchestration changes are safer when replay, approval, and tenant
isolation can be checked against stable identifiers instead of provider-specific
status strings. The current runtime still needs an end-to-end assertion that the
outbound interaction ID is present on delivered responses.

**How to apply:** Before enabling compound or proactive work, keep terminal
states terminal, never retry an unknown provider outcome blindly, require
evidence before action, and fail the delivered-response trace check when any
required link is missing.