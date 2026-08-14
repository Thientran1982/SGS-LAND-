create temp table aiven_ids_tmp(id integer);
\copy aiven_ids_tmp from '/home/runner/workspace/migration_dump/finalids_market_price_history.txt'
\copy (select tt.* from market_price_history tt left join aiven_ids_tmp ai on tt.id=ai.id where ai.id is null order by tt.id) to stdout
