---
name: Generated production backend
description: The production backend entrypoint is a generated bundle rather than the TypeScript source directly.
---

Production can run the generated backend bundle while local development runs the TypeScript entrypoint. Source-only verification can therefore miss production startup behavior.

**Why:** A database outage during startup exposed that the production process was executing an older generated bundle even though the source workflow had already been updated.

**How to apply:** After backend source changes, regenerate the ignored production bundle using the project build command before validating deployment-style startup or interpreting supervisor logs.