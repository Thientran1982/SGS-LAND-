---
name: Live-chat attachment extraction
description: Public upload and multimodal attachment contracts
---

Public uploads must enforce both per-file and aggregate byte limits. Document parsing is parallelized and its result is explicit (`READY`, `EMPTY`, `FAILED`, or `NOT_APPLICABLE`) so missing text is never silently interpreted as an empty document. Audio is transcript-only and must not imply playback storage.

**Why:** Per-file limits alone allow a multi-file request to consume excessive memory, while parser failures otherwise become indistinguishable from documents with no extractable text.

**How to apply:** Preserve extraction status through attachment normalization, fail closed on provenance/hash mismatches, and pass only tenant-validated image bytes to general Minh vision calls.