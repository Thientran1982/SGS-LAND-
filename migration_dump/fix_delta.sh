#!/bin/bash
set -uo pipefail
LOG=~/workspace/migration_dump/fix_gaps.log
echo "=== DELTA ROUND2 START $(date) ===" >> "$LOG"

for t in agent_runs user_page_views visitor_logs; do
  echo "--- $t: dumping aiven ids $(date) ---" >> "$LOG"
  idfile=~/workspace/migration_dump/ids_${t}.txt
  psql "$AIVEN_DATABASE_URL" -t -c "select id from $t order by id" 2>>"$LOG" | tr -d ' ' | grep -v '^$' > "$idfile"
  echo "idfile lines: $(wc -l < "$idfile")" >> "$LOG"

  sqlfile=~/workspace/migration_dump/delta_${t}.sql
  cat > "$sqlfile" <<EOF
create temp table aiven_ids_tmp(id uuid);
\copy aiven_ids_tmp from '$idfile'
\copy (select tt.* from $t tt left join aiven_ids_tmp ai on tt.id=ai.id where ai.id is null order by tt.id) to stdout
EOF

  echo "--- $t: running delta extract+load $(date) ---" >> "$LOG"
  psql "$NEON_DIRECT_URL" -q -f "$sqlfile" 2>>"$LOG" | psql "$AIVEN_DATABASE_URL" -c "\copy $t from stdin" >> "$LOG" 2>>"$LOG"
  echo "exit=$? for $t delta round2" >> "$LOG"
done

echo "=== DELTA ROUND2 END $(date) ===" >> "$LOG"
