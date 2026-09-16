#!/usr/bin/env bash
set -euo pipefail

# Publishing packages the workspace after the build. These directories are useful
# in the workspace but are not needed by the Reserved VM runtime and can push the
# image over Replit's 8 GiB layer limit.
PUBLISH_ONLY_PATHS=(
  ".git"
  ".local"
  ".cache"
  "migration_dump"
  "archive"
  ".task2-backup"
  "playwright-report"
  "screenshots"
  "reports"
  "apps/mobile/node_modules"
  "apps/mobile/.expo"
)

# Exercise the supervisor's failure reporting before removing publish-only
# files. Keep this validation process free of database/provider credentials;
# production-startup-failure-smoke.sh also sanitizes the environment used by
# its application-process fixtures.
echo "[publish-validation] running isolated startup failure smoke"
env -i \
  HOME="${HOME:-/tmp}" \
  PATH="$PATH" \
  NODE_ENV=production \
  DOTENV_CONFIG_PATH=/dev/null \
  npm run test:production-startup-failures

for path in "${PUBLISH_ONLY_PATHS[@]}"; do
  if [[ -e "$path" || -L "$path" ]]; then
    echo "[publish-cleanup] removing $path"
    if [[ "${DRY_RUN:-0}" != "1" ]]; then
      rm -rf -- "$path"
    fi
  fi
done

echo "[publish-cleanup] runtime artifacts preserved: dist, server.js, apps/nextjs/.next"