---
name: Local dependency patch controls
description: Requirements for safely mitigating an advisory when an upstream package has no fixed release.
---

When an essential dependency has no upstream fixed version, a local patch is an allowed compensating control only when it is applied in production installs, validated automatically after application, and paired with an explicit advisory exception.

**Why:** Version-based audit scanners continue to report an unpatched release even if the local source is hardened. Development-only patch tooling also creates a production install failure or silently leaves production dependencies unpatched.

**How to apply:** Keep the patch applicator available to production dependency installs, execute a focused verifier immediately after patching, and maintain a machine-readable exception that identifies the advisory, package, patch, and review condition. Add a scoped verification command that distinguishes the intended remediation set from unrelated legacy audit findings.