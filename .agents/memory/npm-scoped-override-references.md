---
name: Scoped npm override references
description: npm 10.8.2 could not resolve scoped-package `$` references in this workspace's Next.js overrides.
---

In this workspace's Next.js package, npm 10.8.2 failed installation with `Unable to resolve reference $@types/react` when scoped type packages were referenced with `$` inside `overrides`, even though those packages were direct dev dependencies. Replacing those references with the matching direct semver ranges made the npm install dry-run succeed; the unscoped `$react` references were unaffected.

**Why:** A publish can complete the root bundle and then fail during the nested Next.js install, so this package-manager behavior is easy to mistake for a deployment infrastructure error.

**How to apply:** If a scoped package `$` override reference fails, use the exact semver range already declared for that direct dependency and validate from the affected package directory with `npm install --dry-run --ignore-scripts --no-audit --no-fund` before republishing.