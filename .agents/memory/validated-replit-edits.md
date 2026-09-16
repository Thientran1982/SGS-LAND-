---
name: Validated .replit edits
description: Protected .replit changes must use the validated temporary-file replacement flow during merges and rebases.
---

Protected `.replit` edits must be written to a workspace-relative temporary file and passed through `verifyAndReplaceDotReplit`; direct patching is rejected. The validator may materialize CRLF line endings, so validate TOML and conflict markers rather than treating whitespace-only diff warnings as a semantic conflict.

**Why:** Rebase conflict resolution could not continue until the protected config was replaced through the validator, and the resulting valid file used CRLF line endings.

**How to apply:** Preserve the complete merged TOML in a temporary file, validate/replace it, then use `continueMergeResolution` instead of `git rebase --continue`.