---
name: Production dependency import checks
description: Runtime dependency validation for generated backend bundles in isolated production-only installs.
---

Importing the generated backend can initialize module-level timers or clients even when server startup is guarded. A dependency-only validation child must explicitly exit after the import succeeds; otherwise a healthy import can be misreported as a timeout.

**Why:** The bundled entrypoint loaded successfully but stayed alive because imported modules retained handles unrelated to HTTP server startup.

**How to apply:** Run the generated bundle from a temporary `npm ci --omit=dev` install, guard application startup with a validation-only environment flag, and terminate the child immediately after the import resolves.