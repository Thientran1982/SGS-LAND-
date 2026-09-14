---
name: Live-chat agent timeouts
description: Minh landing-builder replies can exceed ordinary chat latency and must not be mistaken for failed sends.
---

Landing-builder chat requests can run for several minutes while Minh inspects project data and persists sections. The public route should acknowledge quickly with `PENDING`; Socket.IO and bounded durable-history reconciliation remain the source of truth for the eventual reply.

**Why:** A successful backend run that outlives the browser timeout creates a false “Không gửi được tin nhắn” error and encourages duplicate retries.

Under Aiven connection contention, public lead/message-history requests can take several seconds even when the application is healthy, so a slow history poll must never block the initial acknowledgement or the composer.

**How to apply:** Keep the server acknowledgement deadline short, preserve `requestId` and inbound interaction identity through the run, poll lead history in the background with a finite window, and never classify an accepted pending run as a send failure.