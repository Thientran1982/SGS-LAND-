#!/bin/bash
LOG=~/workspace/migration_dump/fix_sequences.log
echo "START $(date)" > "$LOG"
psql "$AIVEN_DATABASE_URL" -t -A -F'|' -c "
select s.relname as seqname, t.relname as tablename, a.attname as colname
from pg_class s
join pg_depend d on d.objid = s.oid and d.deptype = 'a'
join pg_class t on d.refobjid = t.oid
join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
where s.relkind = 'S';
" | while IFS='|' read -r seqname tablename colname; do
  [ -z "$seqname" ] && continue
  psql "$AIVEN_DATABASE_URL" -t -c "select setval('$seqname', coalesce((select max($colname) from $tablename),1), true);" >> "$LOG" 2>>"$LOG"
  echo "fixed $seqname for $tablename.$colname" >> "$LOG"
done
echo "END $(date)" >> "$LOG"
