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

# 2026-08-12 PRODUCTION OUTAGE FIX (VM memory saturation)
#   Evidence: Reserved VM = 0.5 vCPU / 2 GiB. Deployment "Infrastructure monitoring"
#   showed memory pinned at ~1875 MiB (~92% of the VM) with CPU bursting to 150% while
#   stdout logging AND HTTP responses stopped dead at 2026-08-11T21:36:08Z. The Google
#   load balancer still completed TCP + TLS to the VM but no HTTP byte ever came back,
#   i.e. both Node processes were alive and livelocked in GC, never exiting, so neither
#   restart loop ever fired and downtime was unbounded (10h+).
#   Three gaps this closes:
#     1) Neither Node process had a heap cap, so backend + frontend defaults together
#        could claim more memory than the whole VM has.
#     2) The watchdog only probed the BACKEND. The FRONTEND owns the public port
#        (5000 -> externalPort 80), so a wedged frontend was completely invisible.
#     3) Nothing watched the VM memory floor, so the thrashing state was never broken.
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
FRONTEND_HEALTH_PATH="${FRONTEND_HEALTH_PATH:-/api/live}"
BACKEND_MAX_OLD_SPACE_MB="${BACKEND_MAX_OLD_SPACE_MB:-384}"
FRONTEND_MAX_OLD_SPACE_MB="${FRONTEND_MAX_OLD_SPACE_MB:-512}"
MEMORY_GUARD_INTERVAL_SECS="${MEMORY_GUARD_INTERVAL_SECS:-60}"
MEMORY_GUARD_MIN_AVAIL_MB="${MEMORY_GUARD_MIN_AVAIL_MB:-192}"
MEMORY_GUARD_MAX_STRIKES="${MEMORY_GUARD_MAX_STRIKES:-2}"
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
    PORT="${BACKEND_PORT}" NODE_ENV=production \
      NODE_OPTIONS="--max-old-space-size=${BACKEND_MAX_OLD_SPACE_MB} ${NODE_OPTIONS:-}" \
      node server.js &
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
    BACKEND_URL="${BACKEND_URL}" NODE_ENV=production \
      NODE_OPTIONS="--max-old-space-size=${FRONTEND_MAX_OLD_SPACE_MB} ${NODE_OPTIONS:-}" \
      npx --prefix apps/nextjs next start apps/nextjs -p "${FRONTEND_PORT}" &
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
# Watchdog for the FRONTEND, i.e. the process that owns the PUBLIC port
# (localPort 5000 -> externalPort 80 in .replit). The backend watchdog above cannot see a
# wedged frontend, and a wedged frontend is exactly what the load balancer hangs on.
# It probes ${FRONTEND_HEALTH_PATH}, a Next route handler that touches neither the Express
# backend nor Neon/Upstash, so a database outage cannot cause a pointless restart loop.
run_frontend_watchdog_loop() {
  local failures=0 pid
  sleep "$WATCHDOG_GRACE_SECS"
  while ! is_shutting_down; do
    sleep "$WATCHDOG_INTERVAL_SECS"
    is_shutting_down && break
    pid="$(read_pid "$FRONTEND_PID_FILE")"
    if ! alive "$pid"; then
      failures=0
      continue
    fi
    if curl -fsS -m "$WATCHDOG_TIMEOUT_SECS" -o /dev/null "${FRONTEND_URL}${FRONTEND_HEALTH_PATH}"; then
      if [ "$failures" -gt 0 ]; then
        log "watchdog: frontend ${FRONTEND_HEALTH_PATH} recovered after ${failures} failure(s)"
      fi
      failures=0
    else
      failures=$((failures + 1))
      log "watchdog: frontend ${FRONTEND_HEALTH_PATH} FAILED (${failures}/${WATCHDOG_MAX_FAILURES}) pid=${pid}"
      if [ "$failures" -ge "$WATCHDOG_MAX_FAILURES" ]; then
        log "watchdog: frontend alive but not answering - SIGKILL pid ${pid} to force a restart"
        kill -KILL "$pid" 2>/dev/null
        failures=0
        sleep 10
      fi
    fi
  done
}

rss_mb() {
  local pid="${1:-}" kb
  [ -n "$pid" ] || { echo 0; return; }
  kb="$(ps -o rss= -p "$pid" 2>/dev/null | tr -d " ")"
  [ -n "$kb" ] || { echo 0; return; }
  echo $((kb / 1024))
}

# Memory guard. The outage signature was a VM with almost no memory left: Node does not
# die in that state, it livelocks in GC, so no exit code ever reaches the restart loops and
# no HTTP response is ever produced. Recycling the frontend (the larger consumer) breaks
# the spiral in ~2 minutes instead of never.
run_memory_guard_loop() {
  local strikes=0 avail_kb avail_mb be fe
  sleep "$WATCHDOG_GRACE_SECS"
  while ! is_shutting_down; do
    sleep "$MEMORY_GUARD_INTERVAL_SECS"
    is_shutting_down && break
    avail_kb="$(awk "/^MemAvailable:/ {print \$2; exit}" /proc/meminfo 2>/dev/null)"
    [ -n "$avail_kb" ] || continue
    avail_mb=$((avail_kb / 1024))
    if [ "$avail_mb" -ge "$MEMORY_GUARD_MIN_AVAIL_MB" ]; then
      strikes=0
      continue
    fi
    strikes=$((strikes + 1))
    be="$(read_pid "$BACKEND_PID_FILE")"
    fe="$(read_pid "$FRONTEND_PID_FILE")"
    log "memory guard: MemAvailable=${avail_mb}MB under ${MEMORY_GUARD_MIN_AVAIL_MB}MB (${strikes}/${MEMORY_GUARD_MAX_STRIKES}) backend_rss=$(rss_mb "$be")MB frontend_rss=$(rss_mb "$fe")MB"
    if [ "$strikes" -ge "$MEMORY_GUARD_MAX_STRIKES" ]; then
      if alive "$fe"; then
        log "memory guard: recycling frontend pid ${fe} to reclaim memory"
        kill -KILL "$fe" 2>/dev/null
      elif alive "$be"; then
        log "memory guard: frontend already down - recycling backend pid ${be}"
        kill -KILL "$be" 2>/dev/null
      fi
      strikes=0
      sleep 30
    fi
  done
}

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
  run_frontend_watchdog_loop &
  log "watchdog enabled (every ${WATCHDOG_INTERVAL_SECS}s, ${WATCHDOG_MAX_FAILURES} strikes, probe ${BACKEND_URL}/health)"
else
  log "curl not found  watchdog disabled"
fi

run_memory_guard_loop &
log "memory guard enabled (every ${MEMORY_GUARD_INTERVAL_SECS}s, floor ${MEMORY_GUARD_MIN_AVAIL_MB}MB MemAvailable, ${MEMORY_GUARD_MAX_STRIKES} strikes)"
log "heap caps: backend=${BACKEND_MAX_OLD_SPACE_MB}MB frontend=${FRONTEND_MAX_OLD_SPACE_MB}MB"

wait "$BACKEND_LOOP_PID" "$FRONTEND_LOOP_PID"
