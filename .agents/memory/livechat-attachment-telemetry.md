---
name: Live-chat attachment telemetry
description: Content-free attachment retry metrics must separate readability from provider availability.
---

Live-chat attachment metrics should store only a bounded tenant key, normalized file type, extraction status, processing status, and categorical provider outcome. Keep unreadable attachments separate from timeout/outage/not-processed events so the resend-risk rate is not mistaken for an AI availability rate.

**Why:** An unreadable document needs a different user instruction and operational response than a temporary provider failure, while filenames, document content, full hashes, and provider identities are not needed for the report.

**How to apply:** Record one bounded event per validated attachment at the provider boundary, aggregate by tenant/status/file type, persist through the existing content-free telemetry snapshot, and never add raw attachment or provider payloads to the metric.