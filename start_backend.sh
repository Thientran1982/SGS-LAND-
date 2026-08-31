#!/bin/bash
cd /home/runner/workspace
while true; do
  PORT=5001 npx tsx server.ts >> /tmp/sgs-backend.log 2>&1
  echo "[LAUNCHER] backend exited, restarting in 5s..." >> /tmp/sgs-backend.log
  sleep 5
done
