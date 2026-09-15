---
name: QStash regional endpoint
description: QStash tokens are region-bound and the scheduler must use the matching regional API origin.
---

QStash credentials are region-specific. If the token is issued in `us-east-1`, use `https://qstash-us-east-1.upstash.io`; the default EU endpoint will authenticate with a misleading “user not found in this region” error.

**Why:** The default endpoint and a valid token can both exist while every read-only verification and schedule registration fails because they belong to different QStash regions.

**How to apply:** Keep `QSTASH_URL` as a non-secret deployment environment variable, probe `schedules.list()` before registering schedules, and expose only the endpoint host and readiness state in health/logs.