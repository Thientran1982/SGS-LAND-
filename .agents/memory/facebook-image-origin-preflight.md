---
name: Facebook image origin preflight
description: Facebook auto-posting can fail before provider submission when a database-backed upload origin has a transient network or proxy error
---

The Facebook publisher must distinguish a permanently inaccessible image from a transient failure while probing the public HTTPS origin. Retry network, timeout, throttling, and upstream failures before refusing the post; keep invalid URLs, permanent 4xx responses, non-image responses, and empty bodies final.

**Why:** The public upload URL can return 200 when checked later, while a single cold or proxy-origin request during the scheduled run can fail. Treating that one probe as final prevents the worker from recovering even though Facebook never received a submission.

**How to apply:** Keep the anonymous probe (no provider credentials), use bounded retries, and mark only transient probe failures retryable so the social worker can back off safely. Do not blindly retry after a provider request has begun.