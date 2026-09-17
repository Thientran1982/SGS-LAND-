---
name: Live-chat multimodal boundaries
description: Minh accepts image/document/audio inputs, but each modality follows a different evidence and provider path.
---

Public Minh image questions in GENERAL, LEGAL, VALUATION, PROJECT, and LANDING can reach vision-capable providers as tenant-validated image bytes. PDF/DOCX attachments also retain their original bytes for provider-native file parts, so scanned pages and visual tables/charts can be inspected even when text extraction is EMPTY or FAILED. Audio remains transcript-only.

**Why:** The attachment contract stores secure files and returns normalized envelopes, while providers need different native payloads for images versus documents. Treating every accepted attachment as equally understood would overstate Minh's evidence.

**How to apply:** Keep the allowlist and tenant/path/content-hash checks before provider fetch, label `visualPath` and `extractionStatus`, preserve extraction failures, and expose validated attachment sources alongside specialist evidence.

Provider-unsupported documents whose bounded renderer produces no usable page are terminal attachment failures, not provider outages: retain only the safe attachment name/status and do not retry the same document across providers.

**Why:** Retrying an intrinsically unreadable scan cannot improve the input and previously turned a user-actionable format/manual-review problem into a misleading generic AI outage.

**How to apply:** Carry a typed attachment failure through provider exhaustion and live-chat telemetry, classify it separately from timeout/unavailability, and keep the user-facing message free of provider error details.

Durable input guardrails must receive the same attachment envelope as the live-chat core, including direct tool invocations outside the public outer execution.

**Why:** Attachment fingerprints provide idempotency only; omitting attachments from durable input inspection leaves document text and metadata outside prompt-injection checks.

**How to apply:** Pass validated attachments through the durable `input` field and keep tenant/path/hash validation before any provider fetch.

Price/legal answers must retain the verification disclaimer even when evidence exists; evidence controls escalation, not whether official verification is still recommended.

**Why:** A model or weak source label can otherwise suppress the user-facing safety disclosure by claiming that verification is unnecessary.

**How to apply:** Append the deterministic disclaimer for every sensitive price/legal claim, and only use evidence quality to decide `requiresVerification` and escalation.