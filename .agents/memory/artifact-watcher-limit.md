---
name: Artifact watcher limit
description: Standalone Vite previews can exhaust container file watchers when workspace-wide tooling is enabled.
---

Standalone design previews should avoid workspace-wide file-watching plugins and use polling for Vite development when multiple artifact servers are active.

**Why:** The container can hit ENOSPC before the component renders, producing a misleading preview-server error.

**How to apply:** Scope preview tooling to the artifact, configure server.watch.usePolling, restart the affected workflow, and verify the root and component preview routes.