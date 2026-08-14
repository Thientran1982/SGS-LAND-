#!/bin/bash
set -uo pipefail
LOG=~/workspace/migration_dump/final_delta.log
echo "=== FINAL DELTA START $(date) ===" > "$LOG"

declare -A IDTYPE=( [agent_runs]=uuid [visitor_logs]=uuid [market_price_history]=integer )

for t in agent_runs visitor_logs market_price_history; do
  echo "--- $t: dumping aiven ids $(date) ---" >> "$LOG"
  idfile=~/workspace/migration_dump/finalids_${t}.txt
  psql "$AIVEN_DATABASE_URL" -t -c "select id from $t order by id" 2>>"$LOG" | tr -d ' ' | grep -v '^$' > "$idfile"
  echo "idfile lines: $(wc -l < "$idfile")" >> "$LOG"

  sqlfile=~/workspace/migration_dump/finaldelta_${t}.sql
  cat > "$sqlfile" <<EOF
create temp table aiven_ids_tmp(id ${IDTYPE[$t]});
\copy aiven_ids_tmp from '$idfile'
\copy (select tt.* from $t tt left join aiven_ids_tmp ai on tt.id=ai.id where ai.id is null order by tt.id) to stdout
EOF

  echo "--- $t: running delta extract+load $(date) ---" >> "$LOG"
  psql "$NEON_DIRECT_URL" -q -f "$sqlfile" 2>>"$LOG" | psql "$AIVEN_DATABASE_URL" -c "\copy $t from stdin" >> "$LOG" 2>>"$LOG"
  echo "exit=$? for $t final delta" >> "$LOG"
done

echo "=== FINAL DELTA END $(date) ===" >> "$LOG"
