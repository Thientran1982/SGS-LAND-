---
name: Deployment image budget
description: VM publishing packages the workspace and has an 8 GiB image limit, so ignored local artifacts can still block publish.
---

For VM publishing, `.gitignore` is not a sufficient deployment-size control. Build the required bundles first, then prune development dependencies and remove local caches, migration backups, and test/tooling state from the publish image. Preserve Replit runtime metadata/toolchain directories such as `.config`, `.upm`, and `.up`; declare `nodejs_20` as a system dependency when a direct shell entrypoint must resolve Node in the VM.

**Why:** A successful compile still failed during image packaging because workspace caches, backups, duplicate dependency trees, and the Nix layer pushed the image over Replit's 8 GiB limit. Removing runtime metadata afterward produced a second failure where the supervisor could no longer resolve `node` or `npx`; a later direct-shell deployment showed that the development Node module alone did not guarantee Node in the VM runtime.

**How to apply:** Keep publish cleanup in a guarded production-build script so local source data and runtime toolchain context are preserved; classify every package imported by the bundled backend as a production dependency before pruning; add a size-budget validation when practical.