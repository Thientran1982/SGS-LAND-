#!/bin/bash
BATCH=10
LOG=~/workspace/migration_dump/batch_copy.log
echo "START $(date)" >> "$LOG"
for start in $(seq 1 $BATCH 310); do
  end=$((start+BATCH-1))
  cnt=$(psql "$AIVEN_DATABASE_URL" -t -c "select count(*) from uploaded_files where id between $start and $end;" 2>>"$LOG" | tr -d ' ')
  want=$((end-start+1))
  if [ "$cnt" = "$want" ]; then
    echo "SKIP $start-$end already present" >> "$LOG"
    continue
  fi
  ok=0
  for attempt in 1 2 3 4 5; do
    echo "TRY $start-$end attempt $attempt $(date)" >> "$LOG"
    psql "$NEON_DIRECT_URL" -c "\copy (select * from uploaded_files where id between $start and $end order by id) to stdout" 2>>"$LOG" | psql "$AIVEN_DATABASE_URL" -c "\copy uploaded_files from stdin" >> "$LOG" 2>>"$LOG"
    rc=$?
    if [ $rc -eq 0 ]; then
      echo "OK $start-$end $(date)" >> "$LOG"
      ok=1
      break
    else
      echo "FAIL $start-$end attempt $attempt rc=$rc $(date)" >> "$LOG"
      sleep 3
    fi
  done
done
echo "END $(date)" >> "$LOG"
