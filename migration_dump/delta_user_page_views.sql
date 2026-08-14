create temp table aiven_ids_tmp(id uuid);
\copy aiven_ids_tmp from '/home/runner/workspace/migration_dump/ids_user_page_views.txt'
\copy (select tt.* from user_page_views tt left join aiven_ids_tmp ai on tt.id=ai.id where ai.id is null order by tt.id) to stdout
