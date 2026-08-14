#!/bin/bash
OUT=~/workspace/migration_dump/rowcount_comparison.txt
> "$OUT"
tables=$(psql "$NEON_DIRECT_URL" -t -c "select tablename from pg_tables where schemaname='public' order by tablename;" | tr -d ' ')
printf '%-30s %12s %12s %8s\n' table neon_count aiven_count match >> "$OUT"
for t in $tables; do
  [ -z "$t" ] && continue
  n=$(psql "$NEON_DIRECT_URL" -t -c "select count(*) from \"$t\";" 2>/dev/null | tr -d ' ')
  a=$(psql "$AIVEN_DATABASE_URL" -t -c "select count(*) from \"$t\";" 2>/dev/null | tr -d ' ')
  if [ "$n" = "$a" ]; then m=OK; else m=MISMATCH; fi
  printf '%-30s %12s %12s %8s\n' "$t" "$n" "$a" "$m" >> "$OUT"
done
echo DONE >> "$OUT"
