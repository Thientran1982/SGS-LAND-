---
name: Live-chat agent timeouts
description: Minh landing-builder replies can exceed ordinary chat latency and must not be mistaken for failed sends.
---

Landing-builder chat requests can run for several minutes while Minh inspects project data and persists sections. The public route should acknowledge quickly with `PENDING`; Socket.IO and bounded durable-history reconciliation remain the source of truth for the eventual reply.

**Why:** A successful backend run that outlives the browser timeout creates a false “Không gửi được tin nhắn” error and encourages duplicate retries.

Under Aiven connection contention, public lead/message-history requests can take several seconds even when the application is healthy, so a slow history poll must never block the initial acknowledgement or the composer.

**How to apply:** Keep the server acknowledgement deadline short, preserve `requestId` and inbound interaction identity through the run, expose durable-run status for accepted requests, poll status before history, and never classify an accepted pending run as a send failure.

Assistant replies must use strict run correlation, while lifecycle events may retain tolerant matching for backwards-compatible server payloads; an uncorrelated assistant message must never finish the current run.

**Why:** A human-agent OUTBOUND message can share the live-chat room without carrying the AI run identifiers, so treating missing identifiers as a match prematurely hid the pending indicator.

**How to apply:** Require matching `inboundInteractionId` or `runId` for assistant replies in both socket and history reconciliation, but keep lifecycle matching separate.

Pending browser runs need a five-minute storage TTL and status-read failure circuit breaker; after repeated transient status failures, surface a terminal `STATUS_UNREACHABLE` state instead of spinning forever.

**Why:** Reloads and reconnects can restore stale local state, while an unavailable status endpoint otherwise leaves the widget in an indefinite processing loop.

**How to apply:** Clear expired pending records before restoration, arm bounded reconciliation after PROCESSING reconnects, and convert more than five consecutive status-read failures to FAILED.

Every claimed durable execution must emit exactly one `agent_run_finished`, including lease-loss and checkpoint-loading failures; cached replays are the exception because no new execution is claimed.

**Why:** The client needs a terminal lifecycle signal even when the worker loses its lease or cannot load checkpoints, otherwise it can remain in thinking indefinitely.

**How to apply:** Keep database finalization conditional on lease ownership, but emit the FAILED lifecycle unconditionally for post-claim errors, guarded by the existing one-shot emitter.

Content-free latency telemetry must use a unique request correlation key for each history poll; a lead identifier is not a request identifier.

**Why:** Reusing the lead key made a later poll inherit the earlier request's start time, producing false slow-endpoint alerts and incorrect latency percentiles.

**How to apply:** Omit the idempotency key for independent reads so the telemetry recorder generates a request-scoped key; only reuse keys when joining stages of the same request.

Legacy provider calls must also have a bounded per-attempt deadline. A durable execution may continue after the HTTP 202, but the provider fallback chain must eventually reach a terminal success or error that the status endpoint can report.

**Why:** A live-chat request reached a 202 and then spent 228 seconds in an unbounded legacy Gemini fallback, while the widget's shorter reconcile window left the visitor with a misleading pending state.

**How to apply:** Add timeouts around native-provider calls as well as dispatcher calls, carry the inbound interaction ID in 202/error payloads, and make terminal `ERROR` visible as a user-safe retry state without deleting the saved inbound message.

Async reconciliation must validate its generation after every awaited status/history read before mutating messages, errors, loading state, or timers; only the current generation may release the busy flag.

**Why:** A slow history response could arrive after Socket.IO delivered the assistant reply, overwrite the newer message list with a stale snapshot, and show the delayed-processing warning again.

**How to apply:** Increment the generation when a realtime reply or terminal state stops reconciliation, guard every post-await mutation, and keep a stale poll from clearing a newer poll's busy ownership.

Preparation failures after a 202 acknowledgement must emit a correlated terminal lifecycle event even when no durable execution was claimed.

**Why:** Database contention can reject lead/history/inbound preparation after the browser has already entered its pending state; without a correlated failure, the widget can wait until its reconciliation deadline.

**How to apply:** Guard the post-ack catch path against a second HTTP response and notify the lead room with the inbound interaction identity so Socket.IO can fail the current run safely.

An accepted async run is a normal user-visible status, not an error; unavailable non-Gemini primary models must be removed from the current fallback chain after provider failure or circuit-open.

**Why:** The public chat completed successfully, but a paid/unavailable GLM route followed by native retries stretched one answer to roughly 84 seconds and rendered the pending notice as a red alert, making healthy async work look broken.

**How to apply:** Render pending copy as a neutral live status, reserve alert styling for terminal failures, and skip the failed primary model before entering the known-good fallback models.

Public Minh chat should not insert a delayed informational bubble while an answer is running; the existing composer/loading state is enough, and interactive orchestration must use a bounded provider budget.

**Why:** A post-202 pending notice looked like another AI message in the conversation, while duplicate grounding and an unrestricted provider chain made simple finance questions wait roughly 84 seconds.

**How to apply:** Keep reconciliation silent until a reply or terminal failure, avoid duplicate specialist/grounding lookups, cap Minh's router and response provider attempts, and always advance past unavailable 401/402/403/404 routes.

Public live-chat must have one durable execution owner; do not wrap the public route's execution in a second durable handle_live_chat run.

**Why:** Nested claims duplicated checkpoints, heartbeats, guardrails, and audit writes for one inbound message, increasing Aiven contention and allowing the inner run to appear stalled independently of the outer `202` request.

**How to apply:** Pass the outer resume context into the live-chat core for public requests, keep the inner durable wrapper only for direct tool invocations, and correlate inline audit records to the outer execution ID.

Status reconciliation must treat throttled, unavailable, and network-failed status reads as transient `PROCESSING` signals, not as permission to reload full message history. Honor a bounded server `retryAfter` and combine it with capped exponential backoff; stop after terminal status or the reconciliation deadline.

**Why:** A long-running browser run can otherwise turn one status `429` or slow database read into a repeated history fan-out, consuming the same public rate-limit budget that visitors need for sending messages.

**How to apply:** Keep status reads on their own limiter, preserve `Retry-After` from both JSON and response headers, and let the widget poll status without history fallback until `SUCCESS`/`FAILED` or the explicit deadline.

The public widget must model an accepted run as `sending → thinking → idle/failed`, persist its inbound correlation in browser storage, and treat Socket.IO lifecycle/reply events as primary over delayed history reads.

**Why:** `202` acknowledgement, reconnects, and `agent_run_finished` can all arrive before the outbound interaction; clearing the indicator from HTTP cleanup or a finished event alone creates duplicate sends and false failures.

**How to apply:** Keep the composer locked for every non-idle state, wait 20 seconds without progress before fallback polling, retain the indicator until a correlated assistant message or terminal failure/deadline, and make system-only socket events invisible to the customer bubble.

Degraded provider answers must carry both a stable reason and an explicit outcome; retry and escalation actions must reuse the original inbound interaction.

**Why:** A successful durable run can still be materially degraded after provider fallback, and creating another inbound message during recovery makes the conversation and operator telemetry misleading.

**How to apply:** Persist the reason/outcome on the outbound interaction, aggregate fallback/timeout/unavailable outcomes separately, and use a retry-scoped idempotency key tied to the original inbound ID.

The async public route must never send a second HTTP response after its 202 acknowledgement; a late successful run is delivered through the outbox and Socket.IO.

**Why:** A slow run can persist a valid outbound reply, then `res.json()` after the 202 throws `ERR_HTTP_HEADERS_SENT`; the post-ack catch can incorrectly persist the generic Minh failure over a successful run.

**How to apply:** Check `headersSent` before the success response, keep the late result on the durable delivery path, and treat post-ack errors as preparation failures only when no successful response was already persisted.