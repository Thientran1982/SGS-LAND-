#!/usr/bin/env bash
set -euo pipefail

# Build both servers before pruning anything needed by the compilers.
npm run build

(
  cd apps/nextjs
  npm install
  BACKEND_URL="${BACKEND_URL:-http://localhost:5001}" npm run build
)

# Verify the exact generated backend entrypoint against a clean production-only
# install before pruning the publish image. The check uses a temporary copy, so
# local development dependencies and node_modules remain available to the build.
npm run check:production-dependencies

if [ "${PUBLISH_BUILD:-0}" = "1" ]; then
  # The VM only runs server.js and `next start`; development/test packages are
  # not needed after the build and duplicate a large amount of tooling.
  npm prune --omit=dev
  npm --prefix apps/nextjs prune --omit=dev

  # Replit VM images include the workspace layer. These are local caches,
  # migration backups, and test/tooling state; no production entrypoint reads
  # them. Remove them only inside the publish build image, not from the source
  # workspace.
  rm -rf \
    .cache \
    .local \
    .agents \
    .pythonlibs \
    archive \
    migration_dump \
    playwright-report \
    test-results \
    apps/nextjs/.next/cache \
    node_modules/.cache \
    node_modules/.vite \
    node_modules/.ignored

  echo "Production build complete; publish-only caches and development artifacts removed."
else
  echo "Production build complete; skipped publish-only pruning (set PUBLISH_BUILD=1 for image cleanup)."
fi