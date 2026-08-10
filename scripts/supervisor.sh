#!/bin/bash
# ---------------------------------------------------------------------------
# scripts/supervisor.sh — process supervisor for the Reserved VM deployment.
#
# WHY THIS EXISTS
# Production has crashed twice with a completely silent process death (no
# error/exception/shutdown log — the classic signature of an external
# SIGKILL, most likely an OOM-kill) followed by total downtime, because a
# Reserved VM does NOT auto-restart a process that dies. This script wraps
# both server processes (Express backend + Next.js frontend) in restart
# loops so a crash causes a few seconds of downtime instead of a dead VM
# until someone manually republishes.
#
# WHAT IT DOES
#   - Runs the Express backend (server.js) on $BACKEND_PORT, restarting it
#     immediately whenever it exits, for any reason.
#   - Runs the Next.js frontend, restarting it the same way.
#   - Logs every (re)start with a timestamp and the previous exit code to
#     stdout, so it shows up in `deployment logs` and can be cross-referenced
#     against the periodic memory-usage log lines from server.ts.
#   - Forwards SIGTERM/SIGINT to both children and exits cleanly, so a normal
#     redeploy still shuts down promptly instead of being "restarted" by the
#     supervisor mid-shutdown.
#
# WHAT IT DELIBERATELY DOES NOT DO
#   - No backoff/circuit-breaker: if a process is crash-looping (e.g. a bad
#     deploy), it will restart as fast as it can exit. That is intentional —
#     a fast crash loop is easy to spot in logs, whereas silent downtime is
#     not. If this becomes noisy, add a short sleep before each restart.
# ---------------------------------------------------------------------------
set -u

BACKEND_PORT="${PORT_BACKEND:-5001}"
FRONTEND_PORT="${PORT:-5000}"
BACKEND_URL="http://localhost:${BACKEND_PORT}"

log() {
  echo "[supervisor] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

BACKEND_PID=""
FRONTEND_PID=""

shutdown() {
  log "received shutdown signal — stopping children"
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  wait
  exit 0
}
trap shutdown SIGTERM SIGINT

run_backend_loop() {
  local restarts=0
  while true; do
    log "starting backend (node server.js) on port ${BACKEND_PORT} (restart #${restarts})"
    PORT="${BACKEND_PORT}" NODE_ENV=production node server.js &
    BACKEND_PID=$!
    wait "$BACKEND_PID"
    local exit_code=$?
    restarts=$((restarts + 1))
    log "backend exited with code ${exit_code} — restarting in 2s (total restarts: ${restarts})"
    sleep 2
  done
}

run_frontend_loop() {
  local restarts=0
  # Give the backend a moment to bind its port on the very first boot.
  sleep 5
  while true; do
    log "starting frontend (next start) on port ${FRONTEND_PORT} (restart #${restarts})"
    BACKEND_URL="${BACKEND_URL}" npx --prefix apps/nextjs next start apps/nextjs -p "${FRONTEND_PORT}" &
    FRONTEND_PID=$!
    wait "$FRONTEND_PID"
    local exit_code=$?
    restarts=$((restarts + 1))
    log "frontend exited with code ${exit_code} — restarting in 2s (total restarts: ${restarts})"
    sleep 2
  done
}

run_backend_loop &
BACKEND_LOOP_PID=$!
run_frontend_loop &
FRONTEND_LOOP_PID=$!

wait "$BACKEND_LOOP_PID" "$FRONTEND_LOOP_PID"
