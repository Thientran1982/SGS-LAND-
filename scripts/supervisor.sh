#!/bin/bash
# ---------------------------------------------------------------------------
# scripts/supervisor.sh  process supervisor for the Reserved VM deployment.
#
# WHY THIS EXISTS
#   Production has crashed twice with a completely silent process death (no
#   error/exception/shutdown log  the classic signature of an external
#   SIGKILL, most likely an OOM-kill) followed by total downtime, because a
#   Reserved VM does NOT auto-restart a process that dies. This script wraps
#   both server processes (Express backend + Next.js frontend) in restart
#   loops so a crash causes a few seconds of downtime instead of a dead VM
#   until someone manually republishes.
#
# WHAT IT DOES
#   - Runs the Express backend (server.js) on $BACKEND_PORT, restarting it
#     whenever it exits, for any reason.
#   - Runs the Next.js frontend, restarting it the same way.
#   - Runs a WATCHDOG that probes the backend liveness endpoint and kills a
#     process that is alive but no longer answering.
#   - Logs every (re)start with a timestamp and the previous exit code to
#     stdout, so it shows up in `deployment logs` and can be cross-referenced
#     against the periodic memory-usage log lines from server.ts.
#   - Forwards SIGTERM/SIGINT to both children and exits cleanly, so a normal
#     redeploy still shuts down promptly instead of being "restarted" by the
#     supervisor mid-shutdown.
#
# 2026-08 RELIABILITY FIXES (audit)
#   1) PID PROPAGATION BUG (was: SIGTERM did nothing, then hung).
#      BACKEND_PID/FRONTEND_PID used to be assigned inside `run_backend_loop &`
#      i.e. inside a SUBSHELL, so the parent's copies stayed empty. The trap
#      therefore killed nothing and then blocked forever in `wait`, which means
#      the Express graceful shutdown (io.close -> server.close -> pool.end at
#      server.ts) effectively NEVER ran in production. PIDs are now published
#      through files in $RUNTIME_DIR that the trap can read.
#   2) SHUTTING_DOWN flag so a restart loop cannot resurrect a child that we
#      just asked to stop (and so `wait` cannot race the trap).
#   3) WATCHDOG: the old supervisor only reacted to process *exit*. A process
#      that is alive but wedged (see the uncaughtException comment in server.ts)
#      produced unbounded downtime. The watchdog probes $BACKEND_URL/health and
#      SIGKILLs after N consecutive failures so the loop restarts it.
#   4) CAPPED BACKOFF (2s -> BACKOFF_MAX_SECS) instead of a flat 2s: every boot
#      runs migrations and (in prod) registers QStash schedules, so a bad deploy
#      crash-looping at full speed burns quota and hammers Neon.
# ---------------------------------------------------------------------------
set -u

BACKEND_PORT="${PORT_BACKEND:-5001}"
FRONTEND_PORT="${PORT:-5000}"
BACKEND_URL="http://localhost:${BACKEND_PORT}"

# Tunables (env-overridable so ops can adjust without a code change).
WATCHDOG_INTERVAL_SECS="${WATCHDOG_INTERVAL_SECS:-30}"
WATCHDOG_TIMEOUT_SECS="${WATCHDOG_TIMEOUT_SECS:-5}"
WATCHDOG_MAX_FAILURES="${WATCHDOG_MAX_FAILURES:-3}"
WATCHDOG_GRACE_SECS="${WATCHDOG_GRACE_SECS:-90}"
BACKOFF_MAX_SECS="${BACKOFF_MAX_SECS:-30}"
SHUTDOWN_GRACE_SECS="${SHUTDOWN_GRACE_SECS:-15}"

RUNTIME_DIR="${TMPDIR:-/tmp}/sgs-supervisor.$$"
mkdir -p "$RUNTIME_DIR"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
SHUTDOWN_FLAG="$RUNTIME_DIR/shutting_down"

log() {
  echo "[supervisor] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

is_shutting_down() {
  [ -f "$SHUTDOWN_FLAG" ]
}

read_pid() {
  if [ -f "$1" ]; then cat "$1" 2>/dev/null; fi
}

alive() {
  [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null
}

stop_child() {
  local label="$1" pid="$2"
  if alive "$pid"; then
    log "sending SIGTERM to ${label} (pid ${pid})"
    kill -TERM "$pid" 2>/dev/null
  fi
}

shutdown() {
  # Set the flag FIRST so the restart loops do not start a new child while we
  # are stopping the current one.
  : > "$SHUTDOWN_FLAG"
  log "received shutdown signal  stopping children"

  local be fe waited
  be="$(read_pid "$BACKEND_PID_FILE")"
  fe="$(read_pid "$FRONTEND_PID_FILE")"

  stop_child "backend" "$be"
  stop_child "frontend" "$fe"

  # Give Express its own graceful window (server.ts force-exits at 10s).
  waited=0
  while [ "$waited" -lt "$SHUTDOWN_GRACE_SECS" ]; do
    if ! alive "$be" && ! alive "$fe"; then
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done

  if alive "$be"; then
    log "backend still alive after ${waited}s  SIGKILL"
    kill -KILL "$be" 2>/dev/null
  fi
  if alive "$fe"; then
    log "frontend still alive after ${waited}s  SIGKILL"
    kill -KILL "$fe" 2>/dev/null
  fi

  rm -rf "$RUNTIME_DIR"
  log "shutdown complete after ${waited}s"
  exit 0
}

trap shutdown SIGTERM SIGINT

backoff_secs() {
  local restarts="$1" secs
  secs=$((2 * restarts))
  [ "$secs" -lt 2 ] && secs=2
  [ "$secs" -gt "$BACKOFF_MAX_SECS" ] && secs="$BACKOFF_MAX_SECS"
  echo "$secs"
}

run_backend_loop() {
  local restarts=0 pid exit_code sleep_secs
  while ! is_shutting_down; do
    log "starting backend (node server.js) on port ${BACKEND_PORT} (restart #${restarts})"
    PORT="${BACKEND_PORT}" NODE_ENV=production node server.js &
    pid=$!
    echo "$pid" > "$BACKEND_PID_FILE"
    wait "$pid"
    exit_code=$?
    is_shutting_down && break
    restarts=$((restarts + 1))
    sleep_secs="$(backoff_secs "$restarts")"
    log "backend exited with code ${exit_code}  restarting in ${sleep_secs}s (total restarts: ${restarts})"
    sleep "$sleep_secs"
  done
  log "backend loop exiting (shutdown requested)"
}

run_frontend_loop() {
  local restarts=0 pid exit_code sleep_secs
  # Give the backend a moment to bind its port on the very first boot.
  sleep 5
  while ! is_shutting_down; do
    log "starting frontend (next start) on port ${FRONTEND_PORT} (restart #${restarts})"
    BACKEND_URL="${BACKEND_URL}" npx --prefix apps/nextjs next start apps/nextjs -p "${FRONTEND_PORT}" &
    pid=$!
    echo "$pid" > "$FRONTEND_PID_FILE"
    wait "$pid"
    exit_code=$?
    is_shutting_down && break
    restarts=$((restarts + 1))
    sleep_secs="$(backoff_secs "$restarts")"
    log "frontend exited with code ${exit_code}  restarting in ${sleep_secs}s (total restarts: ${restarts})"
    sleep "$sleep_secs"
  done
  log "frontend loop exiting (shutdown requested)"
}

# Watchdog: catches the "alive but wedged" case that an exit-code-only
# supervisor is blind to. Probes /health (liveness only, no DB call) so a Neon
# outage does NOT trigger a pointless restart loop.
run_watchdog_loop() {
  local failures=0 pid
  sleep "$WATCHDOG_GRACE_SECS"
  while ! is_shutting_down; do
    sleep "$WATCHDOG_INTERVAL_SECS"
    is_shutting_down && break
    pid="$(read_pid "$BACKEND_PID_FILE")"
    if ! alive "$pid"; then
      # Already dead  the backend loop is handling the restart.
      failures=0
      continue
    fi
    if curl -fsS -m "$WATCHDOG_TIMEOUT_SECS" -o /dev/null "${BACKEND_URL}/health"; then
      if [ "$failures" -gt 0 ]; then
        log "watchdog: backend /health recovered after ${failures} failure(s)"
      fi
      failures=0
    else
      failures=$((failures + 1))
      log "watchdog: backend /health FAILED (${failures}/${WATCHDOG_MAX_FAILURES}) pid=${pid}"
      if [ "$failures" -ge "$WATCHDOG_MAX_FAILURES" ]; then
        log "watchdog: backend alive but not answering  SIGKILL pid ${pid} to force a restart"
        kill -KILL "$pid" 2>/dev/null
        failures=0
        sleep 10
      fi
    fi
  done
}

run_backend_loop &
BACKEND_LOOP_PID=$!
run_frontend_loop &
FRONTEND_LOOP_PID=$!

if command -v curl >/dev/null 2>&1; then
  run_watchdog_loop &
  log "watchdog enabled (every ${WATCHDOG_INTERVAL_SECS}s, ${WATCHDOG_MAX_FAILURES} strikes, probe ${BACKEND_URL}/health)"
else
  log "curl not found  watchdog disabled"
fi

wait "$BACKEND_LOOP_PID" "$FRONTEND_LOOP_PID"
