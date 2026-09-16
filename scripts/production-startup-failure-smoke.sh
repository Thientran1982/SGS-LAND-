#!/usr/bin/env bash
set -Eeuo pipefail

# Failure-injection coverage for production-startup-smoke.sh. The fixtures are
# local Node processes only: they neither load the application bundle nor read
# database/provider credentials.

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_PORT="${STARTUP_FAILURE_SMOKE_BACKEND_PORT:-$((5500 + ($$ % 400)))}"
FRONTEND_PORT="${STARTUP_FAILURE_SMOKE_FRONTEND_PORT:-$((BACKEND_PORT + 1))}"
SMOKE_SCRIPT="$ROOT_DIR/scripts/production-startup-smoke.sh"
BACKEND_CRASH_FIXTURE="$ROOT_DIR/scripts/startup-smoke-backend-crash.mjs"
BACKEND_HEALTHY_FIXTURE="$ROOT_DIR/scripts/startup-smoke-backend-healthy.mjs"
FRONTEND_LOOP_FIXTURE="$ROOT_DIR/scripts/startup-smoke-frontend-loop.mjs"

run_expected_failure() {
  local name="$1"
  local backend_entrypoint="$2"
  local frontend_cli="$3"
  local expected_log="$4"
  local output status

  set +e
  output="$(
    STARTUP_SMOKE_BACKEND_PORT="$BACKEND_PORT" \
    STARTUP_SMOKE_FRONTEND_PORT="$FRONTEND_PORT" \
    STARTUP_SMOKE_BACKEND_ENTRYPOINT="$backend_entrypoint" \
    STARTUP_SMOKE_FRONTEND_CLI="$frontend_cli" \
    STARTUP_SMOKE_REQUIRE_PRODUCTION_ARTIFACTS=0 \
    STARTUP_SMOKE_TIMEOUT_SECS=12 \
    STARTUP_SMOKE_STABLE_SECS=1 \
    bash "$SMOKE_SCRIPT" 2>&1
  )"
  status=$?
  set -e

  printf '%s\n' "$output"
  [[ "$status" -ne 0 ]] ||
    { echo "[production-startup-failure-smoke] ${name} unexpectedly passed" >&2; return 1; }
  grep -Fq "[production-startup-smoke] supervisor/backend startup log:" <<<"$output" ||
    { echo "[production-startup-failure-smoke] ${name} did not capture the supervisor log" >&2; return 1; }
  grep -Eq '\[supervisor\].*starting backend' <<<"$output" ||
    { echo "[production-startup-failure-smoke] ${name} omitted the backend startup log" >&2; return 1; }
  grep -Fq "$expected_log" <<<"$output" ||
    { echo "[production-startup-failure-smoke] ${name} omitted expected failure log: $expected_log" >&2; return 1; }
}

run_expected_failure \
  "backend startup crash" \
  "$BACKEND_CRASH_FIXTURE" \
  "$FRONTEND_LOOP_FIXTURE" \
  "backend exited with code 42"

run_expected_failure \
  "frontend restart loop" \
  "$BACKEND_HEALTHY_FIXTURE" \
  "$FRONTEND_LOOP_FIXTURE" \
  "frontend exited with code 43"

echo "[production-startup-failure-smoke] PASS: startup crash and frontend restart-loop logs are surfaced"