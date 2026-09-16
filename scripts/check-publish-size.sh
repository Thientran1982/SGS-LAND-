#!/usr/bin/env bash
set -euo pipefail

# Replit's VM image limit is 8 GiB. Leave headroom for Nix/runtime layers that
# are not represented by the workspace du total.
ROOT="${PUBLISH_SIZE_ROOT:-.}"
BUDGET_GIB="${PUBLISH_SIZE_BUDGET_GIB:-6}"
TOP_ENTRIES="${PUBLISH_SIZE_TOP_ENTRIES:-20}"

if ! [[ "$BUDGET_GIB" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "[publish-size] invalid PUBLISH_SIZE_BUDGET_GIB: $BUDGET_GIB" >&2
  exit 2
fi

budget_bytes="$(awk -v gib="$BUDGET_GIB" 'BEGIN { printf "%.0f", gib * 1024 * 1024 * 1024 }')"
total_bytes="$(du -sx -B1 "$ROOT" | awk 'NR == 1 { print $1 }')"

format_gib() {
  awk -v bytes="$1" 'BEGIN { printf "%.2f GiB", bytes / 1024 / 1024 / 1024 }'
}

echo "[publish-size] workspace=${ROOT} size=$(format_gib "$total_bytes") budget=${BUDGET_GIB} GiB"

if (( total_bytes > budget_bytes )); then
  echo "[publish-size] ERROR: publish workspace exceeds the safety budget" >&2
  echo "[publish-size] largest paths (bytes):" >&2
  du -x -B1 -d 2 "$ROOT" 2>/dev/null \
    | sort -nr \
    | head -n "$TOP_ENTRIES" >&2
  exit 1
fi

echo "[publish-size] OK: enough headroom remains for deployment layers"