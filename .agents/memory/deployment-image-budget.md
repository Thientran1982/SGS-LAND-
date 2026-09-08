---
name: Deployment image budget
description: VM publishing packages the workspace and has an 8 GiB image limit, so ignored local artifacts can still block publish.
---

For VM publishing, `.gitignore` is not a sufficient deployment-size control. Build the required bundles first, then prune development dependencies and remove local caches, migration backups, and test/tooling state from the publish image.

**Why:** A successful compile still failed during image packaging because workspace caches, backups, duplicate dependency trees, and the Nix layer pushed the image over Replit's 8 GiB limit.

**How to apply:** Keep publish cleanup in a guarded production-build script so local source data is preserved; add a size-budget validation when practical.