---
name: Standalone artifact dependencies
description: Newly created design artifacts may need a local install before their Vite preview can resolve declared packages.
---

New artifact scaffolds can have a complete package manifest but no installed dependency tree. A preview may start while failing during CSS/plugin resolution until dependencies are installed in that artifact directory.

**Why:** Vite reports the missing package at runtime, which can look like a component bug even when the component itself is valid.

**How to apply:** After creating an artifact, start its workflow, inspect logs, install its declared packages in the artifact directory if resolution fails, restart, then screenshot before presenting.