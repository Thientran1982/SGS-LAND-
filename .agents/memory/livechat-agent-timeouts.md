---
name: Live-chat agent timeouts
description: Minh landing-builder replies can exceed ordinary chat latency and must not be mistaken for failed sends.
---

Landing-builder chat requests can run for several minutes while Minh inspects project data and persists sections. The client timeout must exceed observed agent execution latency, with a bounded durable-history reconciliation window for proxy resets.

**Why:** A successful backend run that outlives the browser timeout creates a false “Không gửi được tin nhắn” error and encourages duplicate retries.

**How to apply:** Keep the Minh request timeout above the measured production tail, poll the lead history using the inbound interaction id, and keep the total retry/reconcile window finite.