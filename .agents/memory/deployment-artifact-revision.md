---
name: Deployment artifact revision
description: How to distinguish a newly published workspace build from a restart of an older production artifact.
---

Do not assume a recent production startup means the latest workspace code was published. Compare an observable signature from the live log—such as command text or stable source structure—with the current and previous revisions before diagnosing the same error again.

**Why:** A Reserved VM repeatedly restarted an older artifact after the workspace fix had passed clean production-mode preflight. Live error line positions matched the previous revision exactly, while the current revision had moved and replaced those commands.

**How to apply:** After a production-only fix, verify both that a new build was promoted and that live logs exhibit the new revision before running downstream health or smoke checks. Treat a restart of the old artifact as a publishing-state problem, not evidence that the fix failed.