-- Backfill constraints for installations that already applied migration 001.
-- Each block is idempotent because market migrations are tracked separately.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_price_ck') THEN
    ALTER TABLE market_listings ADD CONSTRAINT market_price_ck CHECK (price IS NULL OR price > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_area_ck') THEN
    ALTER TABLE market_listings ADD CONSTRAINT market_area_ck CHECK (area_m2 IS NULL OR area_m2 > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_coords_pair_ck') THEN
    ALTER TABLE market_listings ADD CONSTRAINT market_coords_pair_ck CHECK ((lat IS NULL) = (lng IS NULL)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_lat_ck') THEN
    ALTER TABLE market_listings ADD CONSTRAINT market_lat_ck CHECK (lat IS NULL OR lat BETWEEN 8 AND 24) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_lng_ck') THEN
    ALTER TABLE market_listings ADD CONSTRAINT market_lng_ck CHECK (lng IS NULL OR lng BETWEEN 102 AND 110) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_price_unit_ck') THEN
    ALTER TABLE market_listings ADD CONSTRAINT market_price_unit_ck
      CHECK (price_unit IS NULL OR upper(price_unit) IN ('VND','TY','TRIEU','VND/M2','VND_PER_M2')) NOT VALID;
  END IF;
END $$;

-- Legacy rows were allowed before these checks existed.  Do not infer missing
-- market facts: clear invalid measurements/coordinates and normalize only
-- recognized units.  The migration runner logs the migration transaction, so
-- this remains an auditable, repeatable cleanup.
UPDATE market_listings
SET
  price = CASE WHEN price IS NULL OR price > 0 THEN price ELSE NULL END,
  area_m2 = CASE WHEN area_m2 IS NULL OR area_m2 > 0 THEN area_m2 ELSE NULL END,
  price_unit = CASE
    WHEN price_unit IS NULL OR upper(btrim(price_unit)) IN
      ('VND','TY','TRIEU','VND/M2','VND_PER_M2')
      THEN upper(btrim(price_unit))
    ELSE NULL
  END,
  lat = CASE WHEN lat BETWEEN 8 AND 24 AND lng BETWEEN 102 AND 110 THEN lat ELSE NULL END,
  lng = CASE WHEN lat BETWEEN 8 AND 24 AND lng BETWEEN 102 AND 110 THEN lng ELSE NULL END,
  geom = CASE WHEN lat BETWEEN 8 AND 24 AND lng BETWEEN 102 AND 110 THEN geom ELSE NULL END
WHERE (price IS NOT NULL AND price <= 0)
   OR (area_m2 IS NOT NULL AND area_m2 <= 0)
   OR (price_unit IS NOT NULL AND upper(btrim(price_unit)) NOT IN
     ('VND','TY','TRIEU','VND/M2','VND_PER_M2'))
   OR (lat IS NULL) <> (lng IS NULL)
   OR (lat IS NOT NULL AND (lat NOT BETWEEN 8 AND 24 OR lng NOT BETWEEN 102 AND 110));

-- Make the checks active only after the controlled backfill above succeeds.
ALTER TABLE market_listings
  VALIDATE CONSTRAINT market_price_ck,
  VALIDATE CONSTRAINT market_area_ck,
  VALIDATE CONSTRAINT market_coords_pair_ck,
  VALIDATE CONSTRAINT market_lat_ck,
  VALIDATE CONSTRAINT market_lng_ck,
  VALIDATE CONSTRAINT market_price_unit_ck;