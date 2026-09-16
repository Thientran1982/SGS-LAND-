---
name: Production Node entrypoint
description: Reserved VM supervisor startup must preserve the npm-provided Node runtime environment.
---

Use `npm run start:production` as the VM run entrypoint when the supervisor
depends on `npm_node_execpath`, and declare `nodejs_20` as an explicit Nix
system dependency. A direct `sh -c` entrypoint can omit the Nix profile from
`PATH`, while a module available during build may still leave `npm` absent in
the Reserved VM.

**Why:** The production VM accepted the image but returned 500 because the
direct shell command could not resolve Node; npm restored the runtime path and
provided the executable path expected by the supervisor.

**How to apply:** Keep the supervisor behind the npm production script, resolve
both `node` and `npx` before spawning children, explicitly install the matching
Nix runtime, and run a deployment-style startup smoke test after changes to
`.replit` or the production bundle.