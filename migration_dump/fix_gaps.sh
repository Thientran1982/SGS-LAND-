#!/bin/bash
set -uo pipefail
LOG=~/workspace/migration_dump/fix_gaps.log
echo "START $(date)" > "$LOG"

declare -A PK=(
  [ai_cost_plan_quotas]=plan_id
  [ai_feedback]=id
  [buyer_otp_log]=id
  [buyer_users]=id
  [project_price_matrix]=id
  [routing_rules]=id
  [task_assignments]=id
  [valuation_cost_alerts]=tenant_id
  [valuation_usage_log]=id
  [visitor_events]=id
  [vn_districts]=id
  [wf_tasks]=id
)

for t in "${!PK[@]}"; do
  pk=${PK[$t]}
  echo "=== FULL COPY $t (pk=$pk) $(date) ===" >> "$LOG"
  psql "$NEON_DIRECT_URL" -c "\copy (select * from $t order by $pk) to stdout" 2>>"$LOG" | psql "$AIVEN_DATABASE_URL" -c "\copy $t from stdin" >> "$LOG" 2>>"$LOG"
  echo "exit=$? for $t" >> "$LOG"
done

for t in agent_runs user_page_views visitor_logs; do
  echo "=== DELTA COPY $t $(date) ===" >> "$LOG"
  ids=$(psql "$AIVEN_DATABASE_URL" -t -c "select id from $t order by id" 2>>"$LOG" | tr -d ' ' | grep -v '^$' | tr '\n' ',' | sed 's/,$//')
  if [ -z "$ids" ]; then
    cond="true"
  else
    cond="id not in ($ids)"
  fi
  psql "$NEON_DIRECT_URL" -c "\copy (select * from $t where $cond order by id) to stdout" 2>>"$LOG" | psql "$AIVEN_DATABASE_URL" -c "\copy $t from stdin" >> "$LOG" 2>>"$LOG"
  echo "exit=$? for $t" >> "$LOG"
done

echo "END $(date)" >> "$LOG"
