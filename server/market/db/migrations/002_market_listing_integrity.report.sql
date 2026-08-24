WITH affected AS (
  SELECT id, price::text AS price, NULL::text AS area_m2, NULL::text AS price_unit,
         NULL::text AS lat, NULL::text AS lng,
         CASE WHEN price IS NULL OR price > 0 THEN price::text ELSE NULL END AS normalized_price,
         NULL::text AS normalized_area, NULL::text AS normalized_unit,
         NULL::text AS normalized_lat, NULL::text AS normalized_lng
  FROM market_listings WHERE price IS NOT NULL AND price <= 0
  UNION ALL
  SELECT id, NULL, area_m2::text, NULL, NULL, NULL, NULL,
         CASE WHEN area_m2 IS NULL OR area_m2 > 0 THEN area_m2::text ELSE NULL END,
         NULL, NULL, NULL
  FROM market_listings WHERE area_m2 IS NOT NULL AND area_m2 <= 0
  UNION ALL
  SELECT id, NULL, NULL, price_unit, NULL, NULL, NULL, NULL,
         CASE WHEN price_unit IS NULL OR upper(btrim(price_unit)) IN
           ('VND','TY','TRIEU','VND/M2','VND_PER_M2') THEN upper(btrim(price_unit)) ELSE NULL END,
         NULL, NULL
  FROM market_listings WHERE price_unit IS NOT NULL AND upper(btrim(price_unit)) NOT IN
    ('VND','TY','TRIEU','VND/M2','VND_PER_M2')
  UNION ALL
  SELECT id, NULL, NULL, NULL, lat::text, lng::text, NULL, NULL, NULL,
         CASE WHEN lat BETWEEN 8 AND 24 AND lng BETWEEN 102 AND 110 THEN lat::text ELSE NULL END,
         CASE WHEN lat BETWEEN 8 AND 24 AND lng BETWEEN 102 AND 110 THEN lng::text ELSE NULL END
  FROM market_listings
  WHERE (lat IS NULL) <> (lng IS NULL)
     OR (lat IS NOT NULL AND (lat NOT BETWEEN 8 AND 24 OR lng NOT BETWEEN 102 AND 110))
)
SELECT category, COUNT(*)::int AS count,
       jsonb_agg(jsonb_build_object('id', id, 'before', before_value, 'after', after_value)
                 ORDER BY id) FILTER (WHERE sample_no <= 5) AS samples
FROM (
  SELECT id, 'price' AS category, price AS before_value, normalized_price AS after_value,
         row_number() OVER (PARTITION BY 'price' ORDER BY id) AS sample_no FROM affected WHERE price IS NOT NULL
  UNION ALL
  SELECT id, 'area_m2', area_m2, normalized_area,
         row_number() OVER (PARTITION BY 'area_m2' ORDER BY id) FROM affected WHERE area_m2 IS NOT NULL
  UNION ALL
  SELECT id, 'price_unit', price_unit, normalized_unit,
         row_number() OVER (PARTITION BY 'price_unit' ORDER BY id) FROM affected WHERE price_unit IS NOT NULL
  UNION ALL
  SELECT id, 'coordinates', concat_ws(',', lat, lng), concat_ws(',', normalized_lat, normalized_lng),
         row_number() OVER (PARTITION BY 'coordinates' ORDER BY id) FROM affected WHERE lat IS NOT NULL OR lng IS NOT NULL
) preview
GROUP BY category
ORDER BY category;