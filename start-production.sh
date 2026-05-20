#!/bin/bash
set -e

# ─── SGS Land — Production Startup ───────────────────────────────────────────
# Process 1: Express API server  → port 5000 (internal, handles /api/*, WS, uploads)
# Process 2: Next.js frontend    → port $PORT (public, Replit routes domain here)
#
# Next.js next.config.ts rewrites:
#   /api/:path*       → http://localhost:5000/api/:path*
#   /socket.io/:path* → http://localhost:5000/socket.io/:path*
#   /uploads/:path*   → http://localhost:5000/uploads/:path*
#   /images/:path*    → http://localhost:5000/images/:path*
# ─────────────────────────────────────────────────────────────────────────────

NEXTJS_PORT=${PORT:-3000}
EXPRESS_PORT=5000

echo "[startup] Starting Express API server on :${EXPRESS_PORT}..."
# Override PORT so Express always binds to 5000, regardless of $PORT env var
PORT=$EXPRESS_PORT NODE_ENV=production node server.js &
EXPRESS_PID=$!

# Wait up to 30 s for Express to be healthy before opening Next.js
READY=0
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${EXPRESS_PORT}/api/health" > /dev/null 2>&1; then
    READY=1
    echo "[startup] Express API ready after ${i}s"
    break
  fi
  sleep 1
done

if [ "$READY" -eq 0 ]; then
  echo "[startup] WARN: Express did not respond in 30 s — starting Next.js anyway"
fi

echo "[startup] Starting Next.js frontend on :${NEXTJS_PORT}..."

# exec replaces the shell process so signals (SIGTERM) reach Next.js directly
exec env \
  BACKEND_URL="http://localhost:${EXPRESS_PORT}" \
  NODE_ENV=production \
  apps/nextjs/node_modules/.bin/next start \
    --hostname 0.0.0.0 \
    --port "$NEXTJS_PORT"
