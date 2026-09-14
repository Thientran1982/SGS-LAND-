---
name: Live-chat agent timeouts
description: Minh landing-builder replies can exceed ordinary chat latency and must not be mistaken for failed sends.
---

Landing-builder chat requests can run for several minutes while Minh inspects project data and persists sections. The public route should acknowledge quickly with `PENDING`; Socket.IO and bounded durable-history reconciliation remain the source of truth for the eventual reply.

**Why:** A successful backend run that outlives the browser timeout creates a false “Không gửi được tin nhắn” error and encourages duplicate retries.

Under Aiven connection contention, public lead/message-history requests can take several seconds even when the application is healthy, so a slow history poll must never block the initial acknowledgement or the composer.

**How to apply:** Keep the server acknowledgement deadline short, preserve `requestId` and inbound interaction identity through the run, expose durable-run status for accepted requests, poll status before history, and never classify an accepted pending run as a send failure.

Content-free latency telemetry must use a unique request correlation key for each history poll; a lead identifier is not a request identifier.

**Why:** Reusing the lead key made a later poll inherit the earlier request's start time, producing false slow-endpoint alerts and incorrect latency percentiles.

**How to apply:** Omit the idempotency key for independent reads so the telemetry recorder generates a request-scoped key; only reuse keys when joining stages of the same request.

Legacy provider calls must also have a bounded per-attempt deadline. A durable execution may continue after the HTTP 202, but the provider fallback chain must eventually reach a terminal success or error that the status endpoint can report.

**Why:** A live-chat request reached a 202 and then spent 228 seconds in an unbounded legacy Gemini fallback, while the widget's shorter reconcile window left the visitor with a misleading pending state.

**How to apply:** Add timeouts around native-provider calls as well as dispatcher calls, carry the inbound interaction ID in 202/error payloads, and make terminal `ERROR` visible as a user-safe retry state without deleting the saved inbound message.

Status reconciliation must treat throttled, unavailable, and network-failed status reads as transient `PROCESSING` signals, not as permission to reload full message history. Honor a bounded server `retryAfter` and combine it with capped exponential backoff; stop after terminal status or the reconciliation deadline.

**Why:** A long-running browser run can otherwise turn one status `429` or slow database read into a repeated history fan-out, consuming the same public rate-limit budget that visitors need for sending messages.

**How to apply:** Keep status reads on their own limiter, preserve `Retry-After` from both JSON and response headers, and let the widget poll status without history fallback until `SUCCESS`/`FAILED` or the explicit deadline.