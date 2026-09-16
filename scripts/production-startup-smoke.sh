#!/usr/bin/env bash
set -Eeuo pipefail

# Deployment-style smoke test for the exact VM entrypoint. The ports and
# environment are intentionally isolated from the developer workflow and the
# configured deployment. This catches failures in the generated server.js,
# supervisor runtime resolution, and the Next.js production server before the
# publish image is assembled.

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_PORT="${STARTUP_SMOKE_BACKEND_PORT:-5511}"
FRONTEND_PORT="${STARTUP_SMOKE_FRONTEND_PORT:-5510}"
TIMEOUT_SECS="${STARTUP_SMOKE_TIMEOUT_SECS:-90}"
STABLE_SECS="${STARTUP_SMOKE_STABLE_SECS:-8}"
LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/sgs-production-startup.XXXXXX.log")"
SUPERVISOR_PID=""

cleanup() {
  local waited=0
  if [[ -n "$SUPERVISOR_PID" ]] && kill -0 "$SUPERVISOR_PID" 2>/dev/null; then
    kill -TERM "$SUPERVISOR_PID" 2>/dev/null || true
    while kill -0 "$SUPERVISOR_PID" 2>/dev/null && [[ "$waited" -lt 15 ]]; do
      sleep 1
      waited=$((waited + 1))
    done
    if kill -0 "$SUPERVISOR_PID" 2>/dev/null; then
      kill -KILL "$SUPERVISOR_PID" 2>/dev/null || true
    fi
  fi
  wait "$SUPERVISOR_PID" 2>/dev/null || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

fail() {
  echo "[production-startup-smoke] FAILED: $*" >&2
  echo "[production-startup-smoke] supervisor/backend startup log:" >&2
  cat "$LOG_FILE" >&2
  exit 1
}

[[ -f "$ROOT_DIR/server.js" ]] ||
  fail "generated backend bundle server.js is missing; run the production build first"
[[ -f "$ROOT_DIR/apps/nextjs/.next/BUILD_ID" ]] ||
  fail "Next.js production build is missing; run the production build first"
[[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] ||
  fail "backend and frontend smoke ports must be different"

for command_name in curl npm; do
  command -v "$command_name" >/dev/null 2>&1 ||
    fail "required command not found: $command_name"
done

backend_url="http://127.0.0.1:${BACKEND_PORT}"
frontend_url="http://127.0.0.1:${FRONTEND_PORT}"

# Use env -i so .env and Replit-provided provider credentials cannot turn a
# pre-publish check into an external API call. The loopback PostgreSQL URL is
# deliberately unreachable: it lets the bundled DB module initialize while
# making migrations and any database mutation impossible.
env -i \
  HOME="${HOME:-/tmp}" \
  PATH="$PATH" \
  NODE_ENV=production \
  DOTENV_CONFIG_PATH=/dev/null \
  PORT="$FRONTEND_PORT" \
  PORT_BACKEND="$BACKEND_PORT" \
  BACKEND_URL="$backend_url" \
  AIVEN_DATABASE_URL="postgresql://127.0.0.1:1/sgs_startup_smoke" \
  DB_POOL_MAX=2 \
  DB_APPLICATION_NAME=sgs-startup-smoke \
  JWT_SECRET=production-startup-smoke-only \
  ALLOWED_ORIGINS="$frontend_url" \
  PROD_DOMAIN= \
  APP_URL="$frontend_url" \
  QSTASH_TOKEN= \
  QSTASH_CURRENT_SIGNING_KEY= \
  QSTASH_NEXT_SIGNING_KEY= \
  UPSTASH_REDIS_REST_URL= \
  UPSTASH_REDIS_REST_TOKEN= \
  BREVO_API_KEY= \
  GEMINI_API_KEY= \
  API_KEY= \
  OPENAI_API_KEY= \
  ANTHROPIC_API_KEY= \
  XAI_API_KEY= \
  npm run start:production >"$LOG_FILE" 2>&1 &
SUPERVISOR_PID=$!

is_restart_or_crash_logged() {
  grep -Eq \
    'fatal:|runtime toolchain unavailable|backend exited with code|frontend exited with code|restarting in .*s' \
    "$LOG_FILE"
}

probe_status() {
  local url="$1"
  curl -sS -m 3 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo 000
}

assert_healthy() {
  local backend_status frontend_status
  backend_status="$(probe_status "${backend_url}/health")"
  frontend_status="$(probe_status "${frontend_url}/api/live")"
  [[ "$backend_status" == "200" && "$frontend_status" == "200" ]]
}

echo "[production-startup-smoke] starting npm run start:production (backend=${BACKEND_PORT}, frontend=${FRONTEND_PORT})"
deadline=$((SECONDS + TIMEOUT_SECS))
while (( SECONDS < deadline )); do
  kill -0 "$SUPERVISOR_PID" 2>/dev/null ||
    fail "supervisor exited before both health checks passed"
  is_restart_or_crash_logged &&
    fail "supervisor reported a startup crash or restart loop"
  if assert_healthy; then
    break
  fi
  sleep 1
done

(( SECONDS < deadline )) ||
  fail "timed out after ${TIMEOUT_SECS}s waiting for backend /health and Next.js /api/live to return 200"

# A process can bind successfully and then die during late startup (for
# example, while the generated backend initializes). Require a short stable
# window and keep checking both endpoints so that transient success does not
# hide a restart loop.
stable_deadline=$((SECONDS + STABLE_SECS))
while (( SECONDS < stable_deadline )); do
  kill -0 "$SUPERVISOR_PID" 2>/dev/null ||
    fail "supervisor exited during the stability window"
  is_restart_or_crash_logged &&
    fail "supervisor reported a crash/restart after the health checks passed"
  assert_healthy ||
    fail "backend /health or Next.js /api/live stopped returning 200 during the stability window"
  sleep 1
done

echo "[production-startup-smoke] PASS: backend /health and Next.js /api/live returned 200 for ${STABLE_SECS}s"