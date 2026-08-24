-- ============================================================================
-- Migration 001: market_listings
-- Stores normalized real-estate listings for internal market/price analytics.
--
-- SOURCE POLICY: rows here come from first-party submissions and licensed
-- partner feeds. Do NOT republish third-party original content/images publicly
-- without reviewing the relevant ToS and IP/competition law first.
-- ============================================================================

-- PostGIS is required for the geography column + spatial queries.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enum of allowed data sources. "user" = submitted on SGSLand,
-- "partner_api" = licensed partner feed, "import" = licensed bulk import.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_listing_source') THEN
    CREATE TYPE market_listing_source AS ENUM ('user', 'partner_api', 'import');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS market_listings (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source              market_listing_source NOT NULL,
  region              TEXT NOT NULL,
  external_listing_id TEXT NOT NULL,
  title               TEXT,
  price               NUMERIC(18, 2),
  price_unit          TEXT,                    -- e.g. 'VND', 'ty', 'trieu', 'VND/m2'
  area_m2             NUMERIC(12, 2),
  address_raw         TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  geom                GEOGRAPHY(Point, 4326),  -- geocoded point (WGS84)
  images              JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of stored image URLs
  raw_html_hash       TEXT,                    -- content hash for change detection
  missed_crawls       INTEGER NOT NULL DEFAULT 0, -- consecutive syncs where not seen
  is_active           BOOLEAN NOT NULL DEFAULT TRUE, -- false = de-listed/removed
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_market_listings_source_ext UNIQUE (source, external_listing_id)
  ,CONSTRAINT market_price_ck CHECK (price IS NULL OR price > 0)
  ,CONSTRAINT market_area_ck CHECK (area_m2 IS NULL OR area_m2 > 0)
  ,CONSTRAINT market_coords_pair_ck CHECK ((lat IS NULL) = (lng IS NULL))
  ,CONSTRAINT market_lat_ck CHECK (lat IS NULL OR lat BETWEEN 8 AND 24)
  ,CONSTRAINT market_lng_ck CHECK (lng IS NULL OR lng BETWEEN 102 AND 110)
  ,CONSTRAINT market_price_unit_ck CHECK (price_unit IS NULL OR upper(price_unit) IN ('VND','TY','TRIEU','VND/M2','VND_PER_M2'))
);

CREATE INDEX IF NOT EXISTS idx_market_listings_region      ON market_listings (region);
CREATE INDEX IF NOT EXISTS idx_market_listings_active      ON market_listings (is_active);
CREATE INDEX IF NOT EXISTS idx_market_listings_last_seen   ON market_listings (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_market_listings_geom        ON market_listings USING GIST (geom);

-- Dedup table for image content hashes -> stored URL (avoid re-uploading dupes).
CREATE TABLE IF NOT EXISTS market_listing_images (
  sha256      TEXT PRIMARY KEY,          -- SHA-256 of the raw image bytes
  url         TEXT NOT NULL,             -- stored (Cloudinary) URL
  width       INTEGER,
  height      INTEGER,
  bytes       INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
