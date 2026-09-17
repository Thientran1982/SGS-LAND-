---
name: Live-chat multimodal boundaries
description: Minh accepts image/document/audio inputs, but each modality follows a different evidence and provider path.
---

Public Minh image questions in the GENERAL path can reach vision-capable providers as tenant-validated image bytes. Documents are currently text-extraction only, and audio is transcript-only; scanned PDFs, charts, and raw audio are not available to the response model.

**Why:** The attachment contract stores secure files and returns normalized envelopes, but provider payloads only define image parts. Treating every accepted attachment as equally understood would overstate Minh's evidence.

**How to apply:** Label modality support explicitly, preserve extraction failures, and add visual document/file-part support before claiming that legal, valuation, or project intents can interpret attached images.

Durable input guardrails must receive the same attachment envelope as the live-chat core, including direct tool invocations outside the public outer execution.

**Why:** Attachment fingerprints provide idempotency only; omitting attachments from durable input inspection leaves document text and metadata outside prompt-injection checks.

**How to apply:** Pass validated attachments through the durable `input` field and keep tenant/path/hash validation before any provider fetch.

Price/legal answers must retain the verification disclaimer even when evidence exists; evidence controls escalation, not whether official verification is still recommended.

**Why:** A model or weak source label can otherwise suppress the user-facing safety disclosure by claiming that verification is unnecessary.

**How to apply:** Append the deterministic disclaimer for every sensitive price/legal claim, and only use evidence quality to decide `requiresVerification` and escalation.