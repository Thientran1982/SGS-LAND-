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