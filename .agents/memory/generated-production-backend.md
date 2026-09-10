---
name: Generated production backend
description: The production backend entrypoint is a generated bundle rather than the TypeScript source directly.
---

Production can run the generated backend bundle while local development runs the TypeScript entrypoint. Source-only verification can therefore miss production startup behavior.

**Why:** A database outage during startup exposed that the production process was executing an older generated bundle even though the source workflow had already been updated.

**How to apply:** After backend source changes, regenerate the ignored production bundle using the project build command, inspect the generated query or import when the change is runtime-sensitive, and only then validate deployment-style startup or supervisor logs.

Parameterized SQL fixes in worker repositories must be verified in both the TypeScript source and the generated backend bundle; a stale bundle can preserve the production-only failure even when local `tsx` tests pass.

**Why:** A social publishing target update was executing the old uncast query from the generated bundle, while the source workflow had already contained the partial fix.

**How to apply:** Add a repository regression test for the SQL contract, rebuild after source edits, and grep the generated bundle for the corrected query before treating the worker as repaired.